import re
import sqlite3

try:
    from psycopg import connect, errors
    from psycopg.rows import dict_row
except ImportError:
    connect = None
    errors = None
    dict_row = None


def schema_name_for_branch(branch_id: str) -> str:
    clean_id = "".join(c for c in str(branch_id) if c.isalnum() or c in ("-", "_")).lower()
    if not clean_id:
        clean_id = "br_main"
    clean_id = clean_id.replace("-", "_")
    return f"branch_{clean_id}"


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def connect_schema(database_url: str, schema: str):
    if connect is None:
        raise RuntimeError("Postgres support requires installing psycopg[binary].")
    raw_conn = connect(database_url, row_factory=dict_row)
    raw_conn.execute(f"CREATE SCHEMA IF NOT EXISTS {quote_identifier(schema)}")
    raw_conn.execute(f"SET search_path TO {quote_identifier(schema)}, public")
    raw_conn.commit()
    return PostgresConnection(raw_conn, schema)


def translate_sql(sql: str) -> str:
    translated = sql
    translated = translated.replace("INSERT OR IGNORE INTO", "INSERT INTO")
    translated = re.sub(r"\bAUTOINCREMENT\b", "", translated, flags=re.IGNORECASE)
    translated = re.sub(
        r"\bINTEGER\s+PRIMARY\s+KEY\s*(,|\n)",
        r"SERIAL PRIMARY KEY\1",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"ON\s+CONFLICT\(",
        "ON CONFLICT (",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"DEFAULT\s+\(datetime\('now',\s*'\+7 days'\)\)",
        "DEFAULT ((CURRENT_TIMESTAMP + INTERVAL '7 days')::text)",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"\bTEXT(\s+NOT\s+NULL)?\s+DEFAULT\s+CURRENT_TIMESTAMP\b",
        lambda match: f"TEXT{match.group(1) or ''} DEFAULT (CURRENT_TIMESTAMP::text)",
        translated,
        flags=re.IGNORECASE,
    )
    translated = _drop_table_foreign_keys(translated)
    translated = re.sub(
        r"expires_at\s*>\s*CURRENT_TIMESTAMP",
        "expires_at::timestamptz > CURRENT_TIMESTAMP",
        translated,
        flags=re.IGNORECASE,
    )
    translated = _replace_qmark_placeholders(translated)

    if "ON CONFLICT DO NOTHING" not in translated.upper():
        translated = _add_do_nothing_for_insert_ignore(sql, translated)

    return translated


def _replace_qmark_placeholders(sql: str) -> str:
    result = []
    in_single = False
    in_double = False
    index = 0
    while index < len(sql):
        char = sql[index]
        if char == "'" and not in_double:
            result.append(char)
            if index + 1 < len(sql) and sql[index + 1] == "'":
                index += 1
                result.append(sql[index])
            else:
                in_single = not in_single
        elif char == '"' and not in_single:
            result.append(char)
            in_double = not in_double
        elif char == "?" and not in_single and not in_double:
            result.append("%s")
        else:
            result.append(char)
        index += 1
    return "".join(result)


def _add_do_nothing_for_insert_ignore(original_sql: str, translated_sql: str) -> str:
    if "INSERT OR IGNORE INTO" not in original_sql.upper():
        return translated_sql
    if re.search(r"\bON\s+CONFLICT\b", translated_sql, flags=re.IGNORECASE):
        return translated_sql
    return translated_sql.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"


def _drop_table_foreign_keys(sql: str) -> str:
    lines = []
    for line in sql.splitlines():
        if line.strip().upper().startswith("FOREIGN KEY "):
            continue
        lines.append(line)
    translated = "\n".join(lines)
    return re.sub(r",\s*\)", "\n)", translated)


def split_script(script: str):
    statements = []
    current = []
    in_single = False
    in_double = False
    index = 0
    while index < len(script):
        char = script[index]
        if char == "'" and not in_double:
            current.append(char)
            if index + 1 < len(script) and script[index + 1] == "'":
                index += 1
                current.append(script[index])
            else:
                in_single = not in_single
        elif char == '"' and not in_single:
            current.append(char)
            in_double = not in_double
        elif char == ";" and not in_single and not in_double:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(char)
        index += 1

    statement = "".join(current).strip()
    if statement:
        statements.append(statement)
    return statements


class PostgresConnection:
    is_postgres = True

    def __init__(self, conn, schema: str):
        self._conn = conn
        self.schema = schema

    def execute(self, sql, params=None):
        cursor = PostgresCursor(self)
        return cursor.execute(sql, params)

    def executemany(self, sql, seq_of_params):
        cursor = PostgresCursor(self)
        return cursor.executemany(sql, seq_of_params)

    def executescript(self, script):
        cursor = PostgresCursor(self)
        return cursor.executescript(script)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


class PostgresCursor:
    def __init__(self, conn: PostgresConnection):
        self._wrapped_conn = conn
        self._conn = conn._conn
        self._cursor = None
        self.lastrowid = None
        self.rowcount = -1
        self._synthetic_rows = None

    def execute(self, sql, params=None):
        if _is_pragma(sql):
            self._synthetic_rows = _pragma_rows(self._conn, sql, params)
            self.rowcount = len(self._synthetic_rows)
            return self

        if _is_sqlite_master_table_lookup(sql):
            self._synthetic_rows = _table_lookup_rows(self._conn, sql, params)
            self.rowcount = len(self._synthetic_rows)
            return self

        translated = translate_sql(sql)
        params = tuple(params or ())
        wants_lastrowid = _should_return_last_id(translated)
        if wants_lastrowid:
            translated = translated.rstrip().rstrip(";") + " RETURNING id"

        self._cursor = self._conn.cursor()
        try:
            self._cursor.execute(translated, params)
            self.rowcount = self._cursor.rowcount
            if wants_lastrowid:
                row = self._cursor.fetchone()
                self.lastrowid = row["id"] if row else None
        except Exception as exc:
            if errors is not None and isinstance(exc, errors.IntegrityError):
                self._conn.rollback()
                raise sqlite3.IntegrityError(str(exc)) from exc
            raise
        return self

    def executemany(self, sql, seq_of_params):
        translated = translate_sql(sql)
        self._cursor = self._conn.cursor()
        try:
            self._cursor.executemany(translated, seq_of_params)
            self.rowcount = self._cursor.rowcount
        except Exception as exc:
            if errors is not None and isinstance(exc, errors.IntegrityError):
                self._conn.rollback()
                raise sqlite3.IntegrityError(str(exc)) from exc
            raise
        return self

    def executescript(self, script):
        for statement in split_script(script):
            self.execute(statement)
        return self

    def fetchone(self):
        if self._synthetic_rows is not None:
            return self._synthetic_rows[0] if self._synthetic_rows else None
        if self._cursor is None:
            return None
        return self._cursor.fetchone()

    def fetchall(self):
        if self._synthetic_rows is not None:
            return list(self._synthetic_rows)
        if self._cursor is None:
            return []
        return self._cursor.fetchall()


def _is_pragma(sql: str) -> bool:
    return sql.strip().upper().startswith("PRAGMA")


def _pragma_rows(conn, sql: str, params):
    match = re.match(r"\s*PRAGMA\s+table_info\(([^)]+)\)", sql, flags=re.IGNORECASE)
    if not match:
        return []
    table_name = match.group(1).strip().strip("\"'")
    rows = conn.execute(
        """
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table_name,),
    ).fetchall()
    return [
        {
            "cid": index,
            "name": row["column_name"],
            "type": "",
            "notnull": 0 if row["is_nullable"] == "YES" else 1,
            "dflt_value": None,
            "pk": 0,
        }
        for index, row in enumerate(rows)
    ]


def _is_sqlite_master_table_lookup(sql: str) -> bool:
    return "SQLITE_MASTER" in sql.upper()


def _table_lookup_rows(conn, sql: str, params):
    table_name = params[0] if params else _extract_sqlite_master_name(sql)
    if not table_name:
        return []
    exists = conn.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = %s
        LIMIT 1
        """,
        (table_name,),
    ).fetchone()
    if not exists:
        return []
    if "SELECT SQL" in sql.upper():
        return [{"sql": ""}]
    return [{"1": 1}]


def _extract_sqlite_master_name(sql: str):
    match = re.search(r"name\s*=\s*'([^']+)'", sql, flags=re.IGNORECASE)
    return match.group(1) if match else None


def _should_return_last_id(sql: str) -> bool:
    normalized = " ".join(sql.strip().split()).upper()
    return normalized.startswith("INSERT INTO USERS ") and "RETURNING" not in normalized

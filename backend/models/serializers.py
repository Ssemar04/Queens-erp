import json


def serialize_user(user):
    def get(col, default=None):
        try:
            val = user[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    raw_pages = get("allowed_pages")
    allowed_pages = None
    if raw_pages:
        try:
            parsed = json.loads(raw_pages)
            if isinstance(parsed, list):
                allowed_pages = parsed
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "id": str(user["id"]),
        "name": user["name"],
        "email": user["email"],
        "role": get("role", "staff"),
        "isActive": bool(get("is_active", 1)),
        "mustChangePassword": bool(get("must_change_password", 0)),
        "branchId": get("branch_id"),
        "allowedPages": allowed_pages,
        "chatUserId": str(user["id"]),
    }


def item_from_row(row):
    # Helper function to get column from row safely
    def get(col, default=None):
        try:
            return row[col]
        except (KeyError, IndexError):
            return default

    return {
        "id": row["id"],
        "sku": row["sku"],
        "barcode": row["barcode"],
        "name": row["name"],
        "description": row["description"],
        "categoryId": get("category_id") or "",
        "status": row["status"],
        "unit": row["unit"],
        "initialQuantity": get("initial_quantity", 0),
        "currentStock": row["current_stock"],
        "reorderPoint": row["reorder_point"],
        "reorderQuantity": row["reorder_quantity"],
        "costPrice": row["cost_price"],
        "sellingPrice": row["selling_price"],
        "branchId": get("branch_id"),
        "supplierId": get("supplier_id"),
        "imageUrl": get("image_url"),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def branch_from_row(row):
    def get(col, default=None):
        try:
            return row[col]
        except (KeyError, IndexError):
            return default

    street = get("street", "")
    building = get("building", "")
    floor = get("floor", "")
    room_number = get("room_number", "")
    branch_manager = get("branch_manager", "")
    address_parts = [part for part in [street, building, floor, room_number] if part]

    return {
        "id": row["id"],
        "name": row["name"],
        "description": get("description", "") or "",
        "street": street,
        "building": building,
        "floor": floor,
        "roomNumber": room_number,
        "branchManager": branch_manager,
        "receiptTitle": get("receipt_title", "") or "",
        "phone": get("phone", "") or "",
        "email": get("email", "") or "",
        "contactLine": get("contact_line", "") or "",
        "receiptSlogan": get("receipt_slogan", "") or "",
        "taxId": get("tax_id", "") or "",
        "receiptVerificationBaseUrl": get("receipt_verification_base_url", "") or "",
        "isActive": bool(get("is_active", 1)),
        "createdAt": row["created_at"],
        "updatedAt": get("updated_at", row["created_at"]),
        # Compatibility fields for older location consumers that still expect the previous shape.
        "type": get("type", "warehouse") or "warehouse",
        "parentId": get("parent_id"),
        "address": ", ".join(address_parts) if address_parts else (get("address", "") or ""),
    }


def category_from_row(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "parentId": row["parent_id"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def supplier_from_row(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "contactName": row["contact_name"],
        "email": row["email"],
        "phone": row["phone"],
        "address": row["address"],
        "leadTimeDays": row["lead_time_days"],
        "rating": row["rating"],
        "isActive": bool(row["is_active"]),
        "notes": row["notes"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def location_from_row(row):
    return branch_from_row(row)


def movement_from_row(row):
    sale = None

    # Helper function to get column from row safely
    def get(col, default=None):
        try:
            return row[col]
        except (KeyError, IndexError):
            return default

    transaction_id = get("transaction_id")
    transaction_sale_details = get("transaction_sale_details")
    if transaction_sale_details:
        try:
            sale = json.loads(transaction_sale_details)
        except json.JSONDecodeError:
            sale = None

    if sale is None:
        try:
            if row["sale"]:
                try:
                    sale = json.loads(row["sale"])
                except json.JSONDecodeError:
                    sale = None
        except (KeyError, IndexError):
            pass

    if transaction_id:
        if sale is None:
            sale = {}

        receipt_num = get("transaction_number") or row["reference"]
        if receipt_num:
            sale["receiptNumber"] = receipt_num

        item_name = get("transaction_item_name")
        if item_name is not None:
            sale["itemName"] = item_name

        if get("transaction_unit_price") is not None:
            sale["unitPrice"] = float(get("transaction_unit_price") or 0)

        if get("transaction_total_amount") is not None:
            sale["totalAmount"] = float(get("transaction_total_amount") or 0)

        if get("transaction_discount") is not None:
            sale["discount"] = float(get("transaction_discount") or 0)

        if get("transaction_tax") is not None:
            sale["vat"] = float(get("transaction_tax") or 0)

        if get("transaction_vat_rate") is not None:
            sale["vatRate"] = float(get("transaction_vat_rate") or 0)

        if get("transaction_cumulative_amount") is not None:
            sale["cumulativeAmount"] = float(get("transaction_cumulative_amount") or 0)

        if get("transaction_amount_paid") is not None:
            sale["deposit"] = float(get("transaction_amount_paid") or 0)

        if get("transaction_balance") is not None:
            sale["balance"] = float(get("transaction_balance") or 0)

        if get("transaction_amount_tendered") is not None:
            sale["amountTendered"] = float(get("transaction_amount_tendered") or 0)

        if get("transaction_change_due") is not None:
            sale["changeDue"] = float(get("transaction_change_due") or 0)

        pm = get("transaction_payment_method")
        if pm:
            sale["paymentMethod"] = pm

        st = get("transaction_status")
        if st:
            sale["status"] = st

        cb = get("transaction_created_by") or row["performed_by"]
        if cb:
            sale["staff"] = cb

        cid = get("transaction_customer_id")
        if cid is not None:
            sale["customerId"] = cid

        cn = get("transaction_customer_name")
        if cn is not None:
            sale["customer"] = cn or "Walk-in"

        tp = get("transaction_telephone")
        if tp is not None:
            sale["telephone"] = tp

        em = get("transaction_email")
        if em is not None:
            sale["email"] = em

        aid = get("transaction_asset_id")
        if aid is not None:
            sale["assetId"] = aid

        an = get("transaction_asset_name")
        if an is not None:
            sale["assetName"] = an
    elif sale is not None:
        sale.setdefault("receiptNumber", row["reference"])
        sale.setdefault("status", "paid")
        sale.setdefault("customer", "Walk-in")
        sale.setdefault("staff", row["performed_by"])

    return {
        "id": row["id"],
        "itemId": row["item_id"] or "",
        "type": row["movement_type"],
        "quantity": row["quantity"],
        "fromBranchId": get("from_branch_id", get("from_location_id")),
        "toBranchId": get("to_branch_id", get("to_location_id")),
        "fromLocationId": get("from_location_id"),
        "toLocationId": get("to_location_id"),
        "reference": row["reference"],
        "notes": row["notes"],
        "performedBy": row["performed_by"],
        "createdAt": row["created_at"],
        "sale": sale,
    }


def sales_order_item_from_row(row):
    def get(col, default=None):
        try:
            val = row[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    return {
        "id": row["id"],
        "itemId": get("item_id"),
        "name": get("name", ""),
        "quantity": int(get("quantity", 1) or 1),
        "unitPrice": float(get("unit_price", 0) or 0),
        "total": float(get("total", 0) or 0),
    }


def sales_order_from_row(row, items=None):
    attachment = None
    if row["quotation_attachment"]:
        try:
            attachment = json.loads(row["quotation_attachment"])
        except json.JSONDecodeError:
            attachment = None

    def get(col, default=None):
        try:
            val = row[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    complaints = []
    raw_complaints = get("complaints")
    if raw_complaints:
        try:
            parsed = json.loads(raw_complaints)
            if isinstance(parsed, list):
                complaints = parsed
        except (json.JSONDecodeError, TypeError):
            complaints = []

    req_docs = []
    raw_req_docs = get("required_document_types")
    if raw_req_docs:
        try:
            parsed = json.loads(raw_req_docs)
            if isinstance(parsed, list):
                req_docs = parsed
        except (json.JSONDecodeError, TypeError):
            req_docs = []

    acc_details = None
    raw_acc_details = get("account_details")
    if raw_acc_details:
        try:
            acc_details = json.loads(raw_acc_details)
        except (json.JSONDecodeError, TypeError):
            acc_details = None

    return {
        "id": row["id"],
        "lpoNumber": get("lpo_number", ""),
        "dateReceived": get("date_received", ""),
        "customerName": get("customer_name", ""),
        "customerId": get("customer_id"),
        "customerQuotation": get("customer_quotation", ""),
        "quotationAttachment": attachment if isinstance(attachment, dict) else None,
        "dateToBeDelivered": get("date_to_be_delivered", ""),
        "handledBy": get("handled_by", ""),
        "employeeId": get("employee_id"),
        "status": get("status", "submitted"),
        "declineReason": get("decline_reason"),
        "complaints": complaints,
        "amount": float(get("amount", 0) or 0),
        "notes": get("notes"),
        "requiredDocumentTypes": req_docs,
        "accountDetails": acc_details,
        "isLpoAccount": bool(get("is_lpo_account", 0)),
        "items": [sales_order_item_from_row(it) for it in (items or [])],
        "createdAt": get("created_at", ""),
        "updatedAt": get("updated_at"),
    }


def sales_order_document_from_row(row):
    def get(col, default=None):
        try:
            val = row[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    return {
        "id": row["id"],
        "salesOrderId": get("sales_order_id", ""),
        "documentType": get("document_type", ""),
        "title": get("title", ""),
        "description": get("description", ""),
        "fileName": get("file_name", ""),
        "fileType": get("file_type", "application/octet-stream"),
        "fileSize": int(get("file_size", 0) or 0),
        "dataUrl": get("data_url", ""),
        "uploadedBy": get("uploaded_by", ""),
        "uploadedAt": get("uploaded_at", ""),
        "updatedAt": get("updated_at"),
    }


def bank_account_from_row(row):
    return {
        "id": row["id"],
        "accountName": row["account_name"],
        "accountNumber": row["account_number"],
        "bankName": row["bank_name"],
        "branch": row["branch"],
        "swiftCode": row["swift_code"],
        "currency": row["currency"],
        "openingBalance": row["opening_balance"],
        "currentBalance": row["current_balance"],
        "status": row["status"],
        "color": row["color"],
        "createdAt": row["created_at"],
    }


def bank_transaction_from_row(row):
    attachment = None
    if row["attachment"]:
        try:
            attachment = json.loads(row["attachment"])
        except json.JSONDecodeError:
            attachment = None

    def get(col, default=None):
        try:
            val = row[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    return {
        "id": row["id"],
        "accountId": row["account_id"],
        "date": row["date"],
        "type": row["txn_type"],
        "subtype": row["subtype"],
        "reference": row["reference"],
        "description": row["description"],
        "amount": row["amount"],
        "party": row["party"],
        "mobileProvider": row["mobile_provider"],
        "reconciled": bool(row["reconciled"]),
        "attachment": attachment if isinstance(attachment, dict) else None,
        "performedBy": get("performed_by", "") or "",
        "createdAt": row["created_at"],
    }


def bank_statement_line_from_row(row):
    return {
        "id": row["id"],
        "accountId": row["account_id"],
        "date": row["date"],
        "description": row["description"],
        "reference": row["reference"],
        "amount": row["amount"],
        "matchedTxnId": row["matched_txn_id"],
        "importedAt": row["imported_at"],
    }


def ledger_entry_from_record(record):
    row, payments = record
    try:
        tags = json.loads(row["tags"] or "[]")
    except json.JSONDecodeError:
        tags = []

    return {
        "id": row["id"],
        "kind": row["kind"],
        "reference": row["reference"],
        "partyName": row["party_name"],
        "partyRef": row["party_ref"],
        "issueDate": row["issue_date"],
        "dueDate": row["due_date"],
        "amount": row["amount"],
        "currency": row["currency"],
        "paid": row["paid"],
        "status": row["status"],
        "notes": row["notes"],
        "payments": [ledger_payment_from_row(payment) for payment in payments],
        "promiseToPay": row["promise_to_pay"],
        "tags": tags if isinstance(tags, list) else [],
        "createdAt": row["created_at"],
    }


def ledger_payment_from_row(row):
    return {
        "id": row["id"],
        "date": row["date"],
        "amount": row["amount"],
        "method": row["method"],
        "reference": row["reference"],
        "note": row["note"],
    }


def expense_category_from_row(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "code": row["code"],
        "color": row["color"],
        "monthlyBudget": row["monthly_budget"],
    }


def expense_from_row(row):
    recurring = None
    travel = None
    if row["recurring"]:
        try:
            recurring = json.loads(row["recurring"])
        except json.JSONDecodeError:
            recurring = None
    if row["travel"]:
        try:
            travel = json.loads(row["travel"])
        except json.JSONDecodeError:
            travel = None

    return {
        "id": row["id"],
        "reference": row["reference"],
        "date": row["date"],
        "type": row["type"],
        "employee": row["employee"],
        "department": row["department"],
        "categoryId": row["category_id"],
        "vendor": row["vendor"],
        "amount": row["amount"],
        "currency": row["currency"],
        "paymentMethod": row["payment_method"],
        "description": row["description"],
        "attachment": row["attachment"],
        "status": row["status"],
        "reimbursable": bool(row["reimbursable"]),
        "reimbursed": bool(row["reimbursed"]),
        "approvedBy": row["approved_by"],
        "rejectedReason": row["rejected_reason"],
        "recurring": recurring if isinstance(recurring, dict) else None,
        "travel": travel if isinstance(travel, dict) else None,
        "createdAt": row["created_at"],
    }


def expense_audit_from_row(row):
    return {
        "id": row["id"],
        "expenseId": row["expense_id"],
        "action": row["action"],
        "actor": row["actor"],
        "note": row["note"],
        "at": row["at"],
    }


def customer_interaction_from_row(row):
    return {
        "id": row["id"],
        "type": row["type"],
        "summary": row["summary"],
        "at": row["at"],
        "by": row["by"],
    }


def customer_from_record(record):
    row, interactions = record
    try:
        tags = json.loads(row["tags"] or "[]")
    except json.JSONDecodeError:
        tags = []

    return {
        "id": row["id"],
        "reference": row["reference"],
        "name": row["name"],
        "type": row["type"],
        "stage": row["stage"],
        "tier": row["tier"],
        "email": row["email"],
        "phone": row["phone"],
        "address": row["address"],
        "city": row["city"],
        "country": row["country"],
        "industry": row["industry"],
        "taxId": row["tax_id"],
        "website": row["website"],
        "contactPerson": row["contact_person"],
        "salesRep": row["sales_rep"],
        "paymentTerms": row["payment_terms"],
        "creditLimit": row["credit_limit"],
        "outstandingBalance": row["outstanding_balance"],
        "lifetimeValue": row["lifetime_value"],
        "totalOrders": row["total_orders"],
        "avgOrderValue": row["avg_order_value"],
        "loyaltyPoints": row["loyalty_points"],
        "tags": tags if isinstance(tags, list) else [],
        "notes": row["notes"],
        "interactions": [customer_interaction_from_row(item) for item in interactions],
        "lastOrderAt": row["last_order_at"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def asset_meter_reading_from_row(row):
    return {
        "id": row["id"],
        "date": row["date"],
        "value": row["value"],
        "recordedBy": row["recorded_by"],
        "note": row["note"],
    }


def asset_service_record_from_row(row):
    return {
        "id": row["id"],
        "date": row["date"],
        "type": row["type"],
        "performedBy": row["performed_by"],
        "cost": row["cost"],
        "notes": row["notes"],
        "nextDueDate": row["next_due_date"],
        "nextDueMeter": row["next_due_meter"],
    }


def asset_income_from_row(row):
    def get(col, default=None):
        try:
            val = row[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    return {
        "id": row["id"],
        "date": get("date", ""),
        "source": get("source", ""),
        "amount": float(get("amount", 0) or 0),
        "currency": get("currency", "UGX") or "UGX",
        "description": get("description", ""),
        "reference": get("reference", ""),
        "recordedBy": get("recorded_by", ""),
        "createdAt": get("created_at", ""),
        "updatedAt": get("updated_at", ""),
    }


def asset_from_record(record):
    row, readings, services, income = record

    def get(col, default=None):
        try:
            val = row[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    return {
        "id": row["id"],
        "tag": row["tag"],
        "name": row["name"],
        "category": row["category"],
        "serialNumber": get("serial_number", "") or "",
        "manufacturer": get("manufacturer", "") or "",
        "model": get("model", "") or "",
        "location": get("location", "") or "",
        "assignedTo": get("assigned_to", "") or "",
        "purchaseDate": row["purchase_date"],
        "purchaseCost": float(get("purchase_cost", 0) or 0),
        "salvageValue": float(get("salvage_value", 0) or 0),
        "usefulLifeYears": int(get("useful_life_years", 5) or 5),
        "status": row["status"],
        "condition": row["condition"],
        "meterUnit": get("meter_unit", "km") or "km",
        "serviceIntervalMeter": int(get("service_interval_meter", 0) or 0),
        "serviceIntervalDays": int(get("service_interval_days", 0) or 0),
        "lastServiceDate": get("last_service_date"),
        "lastServiceMeter": get("last_service_meter"),
        "warrantyExpiry": get("warranty_expiry"),
        "insuranceExpiry": get("insurance_expiry"),
        "notes": get("notes", "") or "",
        "meterReadings": [asset_meter_reading_from_row(r) for r in readings],
        "services": [asset_service_record_from_row(s) for s in services],
        "income": [asset_income_from_row(i) for i in income],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def employee_from_row(row):
    def get(col, default=None):
        try:
            val = row[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    try:
        skills = json.loads(row["skills"] or "[]")
    except (json.JSONDecodeError, TypeError, KeyError):
        skills = []

    try:
        raw_allowed = get("allowed_pages")
        allowed_pages = json.loads(raw_allowed) if raw_allowed else None
    except (json.JSONDecodeError, TypeError, KeyError):
        allowed_pages = None

    return {
        "id": row["id"],
        "code": row["code"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "avatar": get("avatar"),
        "role": row["role"],
        "department": row["department"],
        "manager": get("manager"),
        "location": row["location"],
        "branchId": get("branch_id"),
        "employmentType": row["employment_type"],
        "status": row["status"],
        "joinedAt": row["joined_at"],
        "salary": row["salary"],
        "skills": skills if isinstance(skills, list) else [],
        "allowedPages": allowed_pages if isinstance(allowed_pages, list) else None,
        "emergencyContact": get("emergency_contact"),
        "bio": get("bio"),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def purchase_order_item_from_row(row):
    return {
        "id": row["id"],
        "purchaseOrderId": row["purchase_order_id"],
        "itemId": row["item_id"],
        "quantityOrdered": row["quantity_ordered"],
        "quantityReceived": row["quantity_received"],
        "unitCost": row["unit_cost"],
    }


def purchase_order_from_record(record):
    row, items = record
    return {
        "id": row["id"],
        "orderNumber": row["order_number"],
        "supplierId": row["supplier_id"],
        "status": row["status"],
        "items": [purchase_order_item_from_row(item) for item in items],
        "totalCost": row["total_cost"],
        "expectedDelivery": row["expected_delivery"],
        "notes": row["notes"],
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def notification_from_row(row):
    return {
        "id": row["id"],
        "type": row["type"],
        "title": row["title"],
        "message": row["message"],
        "isRead": bool(row["is_read"]),
        "link": row["link"],
        "referenceId": row["reference_id"],
        "createdAt": row["created_at"],
    }


def chat_user_from_row(row):
    def get(col, default=None):
        try:
            val = row[col]
            return val if val is not None else default
        except (KeyError, IndexError):
            return default

    return {
        "id": row["id"],
        "name": row["name"],
        "role": row["role"],
        "color": row["color"],
        "online": bool(get("online", 1)),
        "lastSeen": get("last_seen"),
        "createdAt": row["created_at"],
    }


def chat_channel_from_row(row):
    import services.chat_service as chat_service
    member_rows = chat_service.get_channel_members(row["id"])
    member_ids = [m["user_id"] for m in member_rows]
    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "emoji": row["emoji"],
        "description": row["description"],
        "memberIds": member_ids,
        "pinnedMessageIds": [],
        "createdAt": row["created_at"],
    }


def chat_message_from_row(row):
    import json
    return {
        "id": row["id"],
        "channelId": row["channel_id"],
        "authorId": row["author_id"],
        "body": row["body"],
        "createdAt": row["created_at"],
        "mentions": json.loads(row["mentions"] or "[]"),
        "attachments": json.loads(row["attachments"] or "[]"),
        "reactions": json.loads(row["reactions"] or "[]"),
        "replyTo": row["reply_to"],
        "edited": bool(row["edited"]),
        "pinned": bool(row["pinned"]),
    }

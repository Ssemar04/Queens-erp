#!/usr/bin/env python3
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE_URL = "http://127.0.0.1:5000/api"

print("Testing API endpoints...")

def get(path: str):
    request = Request(f"{BASE_URL}{path}", method="GET")
    try:
        with urlopen(request, timeout=5) as response:
            return response.status, response.read().decode("utf-8")
    except HTTPError as error:
        return error.code, error.read().decode("utf-8")
    except URLError as error:
        raise RuntimeError(error.reason) from error

# Try to get items - might fail if not authenticated, but let's see
try:
    status, body = get("/items")
    print(f"GET /items status code: {status}")
    if status == 200:
        print("GET /items successful!")
    else:
        print(f"GET /items response: {body}")
except Exception as e:
    print(f"Error testing GET /items: {e}")

# Let's also check movements
try:
    status, body = get("/movements")
    print(f"GET /movements status code: {status}")
    if status == 200:
        print("GET /movements successful!")
    else:
        print(f"GET /movements response: {body}")
except Exception as e:
    print(f"Error testing GET /movements: {e}")

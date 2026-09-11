#!/usr/bin/env python3
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app
from services import catalog_service, movements_service
from models.serializers import item_from_row, movement_from_row

app = create_app()

with app.app_context():
    print("Testing catalog_service.list_items()...")
    try:
        rows = catalog_service.list_items({})
        print(f"Success! Got {len(rows)} items")
        for row in rows:
            try:
                print(f"  - Serializing item...")
                serialized = item_from_row(row)
                print(f"  [OK] Serialized: {serialized['name']}")
            except Exception as e:
                print(f"  [ERROR] Error serializing item: {e}")
                import traceback
                traceback.print_exc()
    except Exception as e:
        print(f"Error listing items: {e}")
        import traceback
        traceback.print_exc()

    print("\nTesting movements_service.list_movements()...")
    try:
        rows = movements_service.list_movements()
        print(f"Success! Got {len(rows)} movements")
        for row in rows:
            try:
                print(f"  - Serializing movement...")
                serialized = movement_from_row(row)
                print(f"  [OK] Serialized: {serialized['type']}")
            except Exception as e:
                print(f"  [ERROR] Error serializing movement: {e}")
                import traceback
                traceback.print_exc()
    except Exception as e:
        print(f"Error listing movements: {e}")
        import traceback
        traceback.print_exc()

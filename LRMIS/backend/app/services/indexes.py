from pymongo import ASCENDING, GEOSPHERE
from pymongo.errors import OperationFailure


def safe_create_index(collection, keys, **kwargs) -> None:
    try:
        collection.create_index(keys, **kwargs)
    except OperationFailure as exc:
        if exc.code != 86:
            raise


def create_indexes(db) -> None:
    safe_create_index(db.land_applications, [("application_id", ASCENDING)], unique=True)
    safe_create_index(db.land_applications, [("status", ASCENDING)])
    safe_create_index(db.land_applications, [("parcel_ref.zone_id", ASCENDING)])
    safe_create_index(db.land_applications, [("parcel_ref.parcel_number", ASCENDING)])

    safe_create_index(db.parcels, [("zone_id", ASCENDING)])
    safe_create_index(db.parcels, [("parcel_number", ASCENDING)])
    safe_create_index(db.parcels, [("parcel_code", ASCENDING)])
    safe_create_index(db.parcels, [("geometry", GEOSPHERE)])

    safe_create_index(db.applicants, [("national_id", ASCENDING)], unique=True)
    safe_create_index(db.staff_members, [("staff_code", ASCENDING)], unique=True)

    safe_create_index(db.users, [("username", ASCENDING)], unique=True)
    safe_create_index(db.users, [("role", ASCENDING)])
    safe_create_index(db.users, [("linked_id", ASCENDING)])

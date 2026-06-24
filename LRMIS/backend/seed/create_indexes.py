def create_indexes(db):
    db.land_applications.create_index("application_id", unique=True)
    db.land_applications.create_index("idempotency_key", sparse=True)
    db.land_applications.create_index("status")
    db.land_applications.create_index("application_type")
    db.land_applications.create_index("parcel_ref.parcel_number")
    db.land_applications.create_index("parcel_ref.zone_id")
    db.land_applications.create_index("timestamps.submitted_at")

    db.parcels.create_index("parcel_code", unique=True)
    db.parcels.create_index([("geometry", "2dsphere")])
    db.parcels.create_index("zone_id")

    db.applicants.create_index("identity.national_id", unique=True, sparse=True)
    db.staff_members.create_index("staff_code", unique=True)

    db.survey_tasks.create_index("application_id")
    db.survey_tasks.create_index("assigned_surveyor_id")
    db.survey_tasks.create_index("status")

    db.certificates.create_index("certificate_id", unique=True)


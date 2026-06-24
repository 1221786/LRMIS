def create_indexes(db):

    db.applicants.create_index("national_id", unique=True)
    db.applicants.create_index("status")

    db.surveyors.create_index("name")
    db.surveyors.create_index("status")
    db.surveyors.create_index("region")
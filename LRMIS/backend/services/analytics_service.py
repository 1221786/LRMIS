from datetime import datetime, timezone


def status_counts(db):
    return list(db.land_applications.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]))


def zone_counts(db):
    return list(db.land_applications.aggregate([{"$group": {"_id": "$parcel_ref.zone_id", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]))


def kpis(db):
    total = db.land_applications.count_documents({})
    pending = db.land_applications.count_documents({"status": {"$in": ["submitted", "pre_checked", "survey_required", "legal_review"]}})
    approved = db.land_applications.count_documents({"status": "approved"})
    rejected = db.land_applications.count_documents({"status": "rejected"})
    objections = db.land_applications.count_documents({"status": "under_objection"})
    certificates = db.certificates.count_documents({"status": "issued"})
    delayed = db.land_applications.count_documents({"priority": "urgent", "status": {"$nin": ["closed", "rejected"]}})
    return {
        "total_applications": total,
        "pending_applications": pending,
        "approved_applications": approved,
        "rejected_applications": rejected,
        "under_objection": objections,
        "certificates_issued": certificates,
        "delayed_applications": delayed,
        "generated_at": datetime.now(timezone.utc),
    }


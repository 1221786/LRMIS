WORKFLOW = {
    "submitted": "pre_checked",
    "pre_checked": "survey_required",
    "survey_required": "surveyed",
    "surveyed": "legal_review",
    "legal_review": "approved",
    "approved": "certificate_issued",
    "certificate_issued": "closed"
}

EXTRA_STATES = [
    "on_hold",
    "rejected",
    "missing_documents",
    "under_objection"
]

def validate_transition(current, new):
    if new in EXTRA_STATES:
        return True

    if current not in WORKFLOW:
        return False

    return WORKFLOW[current] == new
"""Extension capability registry."""

EXTENSION_CAPABILITIES = {
    "ilovepdf-converter": {
        "displayName": "Zoho Acta Mapper · iLovePDF",
        "actions": ["CONVERT_PDF", "CONVERT_MAPPING_PDF"],
        "requiredConnection": True,
    },
    "future-extension": {
        "displayName": "Future Web Extension",
        "actions": ["FUTURE_STEP_START"],
        "requiredConnection": True,
    },
}

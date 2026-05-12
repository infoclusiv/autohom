"""In-memory workflow store."""


class WorkflowStore:
    def __init__(self):
        self._items = {}

    def put(self, workflow):
        self._items[workflow["workflowId"]] = workflow
        return workflow

    def get(self, workflow_id):
        return self._items.get(workflow_id)

    def all(self):
        return list(self._items.values())

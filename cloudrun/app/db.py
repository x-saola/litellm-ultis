from google.cloud import firestore

_client: firestore.AsyncClient | None = None


def get_client() -> firestore.AsyncClient:
    global _client
    if _client is None:
        _client = firestore.AsyncClient(database="litellm")
    return _client


async def get_key(email: str) -> str | None:
    doc = await get_client().collection("user_keys").document(email).get()
    if doc.exists:
        return doc.to_dict().get("key")
    return None


async def save_key(email: str, key: str) -> None:
    await get_client().collection("user_keys").document(email).set({"key": key})

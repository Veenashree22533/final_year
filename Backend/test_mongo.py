
from app.db.mongo import client

try:
    client.admin.command("ping")
    print("MongoDB Connected Successfully!")
except Exception as e:
    print("Connection Failed")
    print(e)
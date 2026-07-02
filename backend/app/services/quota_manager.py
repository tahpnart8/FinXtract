import json
import os
import logging
from datetime import datetime
from threading import Lock

logger = logging.getLogger(__name__)

QUOTA_FILE = "finxtract_quota.json"
MAX_DAILY_QUOTA = 50

# Dùng threading.Lock để tránh Race Condition khi có nhiều request cùng lúc
quota_lock = Lock()

def get_today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")

def _read_quota() -> dict:
    if not os.path.exists(QUOTA_FILE):
        return {"date": get_today_str(), "used": 0}
    try:
        with open(QUOTA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Reset nếu sang ngày mới
            if data.get("date") != get_today_str():
                return {"date": get_today_str(), "used": 0}
            return data
    except Exception as e:
        logger.error(f"Error reading quota: {e}")
        return {"date": get_today_str(), "used": 0}

def _write_quota(data: dict):
    try:
        with open(QUOTA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        logger.error(f"Error writing quota: {e}")

def get_usage() -> int:
    with quota_lock:
        data = _read_quota()
        return data.get("used", 0)

def get_remaining() -> int:
    with quota_lock:
        data = _read_quota()
        return max(0, MAX_DAILY_QUOTA - data.get("used", 0))

def check_and_increment_usage(count: int = 1) -> bool:
    """
    Kiểm tra xem còn đủ quota không. Nếu đủ thì cộng thêm và trả về True.
    Nếu không đủ thì không làm gì cả và trả về False.
    """
    with quota_lock:
        data = _read_quota()
        if data["used"] + count > MAX_DAILY_QUOTA:
            return False
        data["used"] += count
        _write_quota(data)
        return True

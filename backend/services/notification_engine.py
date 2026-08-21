# backend/services/notification_engine.py
"""
SafeSchool Smart Notification Engine
Xử lý kiểm tra cài đặt thông báo của người dùng trước khi gửi,
quản lý Giờ yên lặng (Quiet Hours / DND), SOS Bypass, và Batching queue.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
import pytz


class NotificationEngine:
    """
    Engine kiểm tra cài đặt thông báo cho Backend FastAPI
    """

    @staticmethod
    def is_in_quiet_hours(quiet_hours_config: Dict[str, Any]) -> bool:
        """
        Kiểm tra thời điểm hiện tại có thuộc khung giờ "Giờ yên lặng" (DND) hay không.
        """
        if not quiet_hours_config.get("enabled", False):
            return False

        timezone_str = quiet_hours_config.get("timezone", "Asia/Ho_Chi_Minh")
        try:
            tz = pytz.timezone(timezone_str)
        except Exception:
            tz = pytz.timezone("Asia/Ho_Chi_Minh")

        now_time = datetime.now(tz).time()

        start_str = quiet_hours_config.get("startTime", "22:00")
        end_str = quiet_hours_config.get("endTime", "06:00")

        try:
            start_time = datetime.strptime(start_str, "%H:%M").time()
            end_time = datetime.strptime(end_str, "%H:%M").time()
        except ValueError:
            return False

        if start_time > end_time:
            # Khung giờ qua đêm: ví dụ từ 22:00 đến 06:00 sáng hôm sau
            return now_time >= start_time or now_time <= end_time
        else:
            return start_time <= now_time <= end_time

    @classmethod
    def evaluate_notification_dispatch(
        cls, user_settings: Dict[str, Any], notification_type: str
    ) -> Dict[str, Any]:
        """
        Đánh giá xem thông báo có được phép gửi qua từng kênh (in_app, email, push) hay không.
        
        Returns:
            Dict chứa:
            - in_app (bool)
            - email (bool)
            - push (bool)
            - should_batch (bool)
            - reason (str)
        """
        # 1. Kiểm tra Master Switch
        if not user_settings.get("masterEnabled", True):
            return {
                "in_app": False,
                "email": False,
                "push": False,
                "should_batch": False,
                "reason": "Master switch OFF",
            }

        # 2. Lấy cấu hình riêng của loại thông báo
        channels = user_settings.get("channels", {}).get(notification_type, {})
        in_app_enabled = channels.get("in_app", True)
        email_enabled = channels.get("email", False)
        push_enabled = channels.get("push", False)

        # Nếu cả 3 kênh đều tắt cho loại thông báo này
        if not (in_app_enabled or email_enabled or push_enabled):
            return {
                "in_app": False,
                "email": False,
                "push": False,
                "should_batch": False,
                "reason": f"All channels disabled for {notification_type}",
            }

        # 3. Kiểm tra Giờ Yên Lặng (Do Not Disturb - DND)
        quiet_hours = user_settings.get("quietHours", {})
        in_dnd = cls.is_in_quiet_hours(quiet_hours)
        is_sos_alert = notification_type == "sos_alert"
        allow_sos_bypass = quiet_hours.get("allowSosBypass", True)

        # Nếu trong giờ DND và không phải SOS Bypass khẩn cấp
        if in_dnd:
            if is_sos_alert and allow_sos_bypass:
                # Ghi đè DND cho SOS Khẩn cấp
                pass
            else:
                # Trong DND -> Vẫn lưu In-app im lặng nhưng chặn Push & Email
                return {
                    "in_app": in_app_enabled,
                    "email": False,
                    "push": False,
                    "should_batch": True,
                    "reason": "Quiet Hours (DND) Active - Suppressed push & email",
                }

        # 4. Kiểm tra Chế độ Gộp (Batching)
        batching_config = user_settings.get("batching", {})
        batch_frequency = batching_config.get("frequency", "instant")
        batchable_types = batching_config.get(
            "batchableTypes", ["article_like", "article_comment", "new_post_followed"]
        )

        should_batch = (
            batching_config.get("enabled", True)
            and (batch_frequency != "instant")
            and (notification_type in batchable_types)
        )

        return {
            "in_app": in_app_enabled,
            "email": email_enabled,
            "push": push_enabled,
            "should_batch": should_batch,
            "batch_frequency": batch_frequency,
            "reason": "Allowed for dispatch",
        }

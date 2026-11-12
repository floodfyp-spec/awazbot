import os
from dotenv import load_dotenv
load_dotenv()
from awaz_core.notify_email import _send_smtp_email_sync

print("Sending live test email to mubasiranwar70@gmail.com...")
res = _send_smtp_email_sync(
    to_email="mubasiranwar70@gmail.com",
    subject="✅ AwazBot KP - Test Booking Notification Delivery",
    text_content="AwazBot KP test notification email is working successfully!",
    html_content="<div style='font-family:sans-serif;padding:20px;'><h2 style='color:#059669;'>AwazBot KP</h2><p>Your Gmail notification system is active and verified!</p></div>"
)
print("Send Result:", res)

import os
from groq import Groq
from dotenv import load_dotenv

# Tải biến môi trường
load_dotenv(dotenv_path="backend/.env")

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("❌ LỖI: Không tìm thấy GROQ_API_KEY trong file .env")
    exit(1)

print("🔑 Đã nạp API Key thành công.")
print("Đang khởi tạo Groq Client...")

try:
    client = Groq(api_key=api_key)
    
    print("\n--------------------------------------------------")
    print("🧪 BÀI TEST 1: GỬI THỬ ẢNH ĐẾN LLAMA-4-SCOUT (Vision Mode)")
    print("--------------------------------------------------")
    
    # Tạo ảnh giả lập dạng Base64 (1px PNG trắng)
    dummy_base64_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Trích xuất văn bản trong ảnh này"},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{dummy_base64_image}"}}
                ]
            }
        ]
    )
    print("✅ THÀNH CÔNG! Model Vision hoạt động bình thường:")
    print(response.choices[0].message.content)

except Exception as e:
    print("\n❌ PHÁT HIỆN LỖI API:")
    print(e)
    
    if "Rate limit reached" in str(e) or "429" in str(e):
        print("\n⚠️ CHÚ Ý: Đây là lỗi Rate Limit (Hết lượt dùng trong ngày / TPD). Bạn cần đổi API Key mới hoặc đợi ngày mai.")
    elif "model_decommissioned" in str(e) or "400" in str(e):
        print("\n⚠️ CHÚ Ý: Model này đã bị Groq khai tử hoặc không hỗ trợ định dạng này.")

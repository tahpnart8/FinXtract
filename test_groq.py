import os
import sys

# Yêu cầu cài đặt thư viện trước khi chạy: pip install groq
try:
    from groq import Groq
except ImportError:
    print("Thư viện 'groq' chưa được cài đặt. Vui lòng chạy: pip install groq")
    sys.exit(1)

def test_groq_vision(api_key):
    # Khởi tạo client với API key
    client = Groq(api_key=api_key)
    
    # Model bạn muốn test (thay đổi nếu cần)
    MODEL_NAME = "meta-llama/llama-4-scout-17b-16e-instruct" # Nếu Groq đã ra mắt bản llama 4 scout, bạn có thể thay tên vào đây
    
    # URL của một hình ảnh mẫu (Biểu đồ hoặc hóa đơn bất kỳ trên mạng)
    IMAGE_URL = "https://cellphones.com.vn/sforum/wp-content/uploads/2023/05/chuyen-hinh-anh-thanh-van-ban-3.jpg"

    print(f"Đang kết nối đến Groq API...")
    print(f"Sử dụng model: {MODEL_NAME}")
    print(f"Gửi thử một hình ảnh mẫu...")

    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Mô tả ngắn gọn hình ảnh này bằng tiếng Việt."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": IMAGE_URL,
                            },
                        },
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=500,
        )

        print("\n✅ KẾT QUẢ TỪ GROQ VISION:")
        print("-" * 50)
        print(completion.choices[0].message.content)
        print("-" * 50)
        print("Tất cả hoạt động hoàn hảo! Groq Vision đã sẵn sàng.")

    except Exception as e:
        print("\n❌ CÓ LỖI XẢY RA:")
        print(e)
        print("\nNếu lỗi liên quan đến model_not_found, có thể model 'llama-4-scout' chưa public hoặc tên chưa chính xác. Bạn hãy đăng nhập Groq Console để xem tên model chính xác.")

if __name__ == "__main__":
    print("=== BÀI TEST GROQ VISION API ===")
    key = input("Nhập Groq API Key của bạn vào đây (bắt đầu bằng gsk_...): ").strip()
    
    if not key:
        print("Bạn chưa nhập API Key!")
    else:
        test_groq_vision(key)

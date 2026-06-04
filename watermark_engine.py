import sys
import cv2
import argparse
from imwatermark import WatermarkEncoder, WatermarkDecoder

def embed_watermark(input_path, output_path, secret_text):
    """
    درج واترمارک فرکانسی نامرئی در تصویر با روش DWT + DCT
    """
    try:
        # خواندن تصویر
        bgr = cv2.imread(input_path)
        if bgr is None:
            raise ValueError("تصویر یافت نشد یا فرمت پشتیبانی نمی‌شود.")

        # تنظیمات انکودر
        encoder = WatermarkEncoder()
        # طول واترمارک باید بر اساس بایت تنظیم شود
        watermark_bytes = secret_text.encode('utf-8')
        encoder.set_watermark('bytes', watermark_bytes)
        
        # اعمال واترمارک فرکانسی (DWT + DCT یکی از مقاوم‌ترین روش‌هاست)
        bgr_encoded = encoder.encode(bgr, 'dwtDct')
        
        # ذخیره تصویر خروجی
        cv2.imwrite(output_path, bgr_encoded)
        print(f"SUCCESS_EMBED|{output_path}")
        
    except Exception as e:
        print(f"ERROR|{str(e)}")

def extract_watermark(input_path, secret_length):
    """
    استخراج واترمارک نامرئی از تصویر
    """
    try:
        bgr = cv2.imread(input_path)
        if bgr is None:
            raise ValueError("تصویر یافت نشد.")

        # طول بایت پیام مخفی باید به دیکودر داده شود
        decoder = WatermarkDecoder('bytes', secret_length * 8)
        watermark_bytes = decoder.decode(bgr, 'dwtDct')
        
        # تبدیل بایت به متن
        decoded_text = watermark_bytes.decode('utf-8', errors='ignore')
        print(f"SUCCESS_EXTRACT|{decoded_text}")
        
    except Exception as e:
        print(f"ERROR|{str(e)}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Frequency Watermarking Engine")
    parser.add_argument('--action', choices=['embed', 'extract'], required=True)
    parser.add_argument('--input', required=True, help="مسیر تصویر ورودی")
    parser.add_argument('--output', help="مسیر تصویر خروجی (برای حالت embed)")
    parser.add_argument('--text', help="متن واترمارک (برای حالت embed)")
    parser.add_argument('--length', type=int, help="طول کاراکتر متن مخفی (برای حالت extract)")
    
    args = parser.parse_args()
    
    if args.action == 'embed':
        if not args.output or not args.text:
            print("ERROR|برای درج واترمارک، مسیر خروجی و متن الزامی است.")
        else:
            embed_watermark(args.input, args.output, args.text)
            
    elif args.action == 'extract':
        if not args.length:
            print("ERROR|برای استخراج، تعیین طول (تعداد کاراکتر) متن مخفی الزامی است.")
        else:
            extract_watermark(args.input, args.length)

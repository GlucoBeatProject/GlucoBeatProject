import os
import mysql.connector
from dotenv import load_dotenv

# .env 파일에서 환경 변수 불러오기
load_dotenv()

# DB 접속 정보 설정
db_config = {
    'host': os.getenv("DB_HOST"),
    'user': os.getenv("DB_USER"),
    'password': os.getenv("DB_PASSWORD"),
    'database': os.getenv("DB_NAME"),
    'port': os.getenv("DB_PORT"),
    'ssl_ca': os.getenv("SSL_CERT_PATH") # SSL 인증서 경로 설정
}

connection = None
try:
    # 데이터베이스에 연결
    print("데이터베이스 연결을 시도합니다...")
    connection = mysql.connector.connect(**db_config)

    if connection.is_connected():
        print("데이터베이스에 성공적으로 연결되었습니다.")
        cursor = connection.cursor()

        # 1. 최근 혈당 데이터 5개 조회 (테스트용)
        print("\n--- 최근 혈당 데이터 (5개) ---")
        cgm_query = "SELECT * FROM cgm_records ORDER BY record_time DESC LIMIT 5;"
        cursor.execute(cgm_query)
        cgm_records = cursor.fetchall()
        for record in cgm_records:
            print(record)

        # 2. 최근 인슐린 데이터 5개 조회 (테스트용)
        print("\n--- 최근 인슐린 데이터 (5개) ---")
        insulin_query = "SELECT * FROM insulin_records ORDER BY injection_time DESC LIMIT 5;"
        cursor.execute(insulin_query)
        insulin_records = cursor.fetchall()
        for record in insulin_records:
            print(record)

except mysql.connector.Error as err:
    print(f"데이터베이스 연결 실패: {err}")
    print("--- 확인 사항 ---")
    print("1. .env 파일의 DB_USER, DB_PASSWORD, DB_NAME 정보가 정확한지 확인해주세요.")
    print(f"2. {db_config['ssl_ca']} 파일이 현재 폴더에 있는지 확인해주세요.")
    print("3. Azure Portal에서 서버의 방화벽 규칙에 현재 IP가 허용되었는지 확인해주세요.")


finally:
    # 연결이 성공적으로 생성되었다면 연결을 닫음
    if connection and connection.is_connected():
        cursor.close()
        connection.close()
        print("\n데이터베이스 연결을 닫았습니다.")

import boto3

dynamodb = boto3.client(
    'dynamodb',
    region_name='us-east-1',
    endpoint_url="http://localhost:4566",
    aws_access_key_id="test", 
    aws_secret_access_key="test"
)

# 테이블 목록 출력 (처음엔 아무것도 없으니 빈 리스트 [] 가 뜨면 정상)
print(dynamodb.list_tables())
import boto3

# LocalStack(도커) DynamoDB에 연결
dynamodb = boto3.client(
    'dynamodb',
    region_name='us-east-1',
    endpoint_url="http://localhost:4566",
    aws_access_key_id="test", 
    aws_secret_access_key="test"
)

table_name = "smart-study-backend-dev-Rooms"

print("테이블 생성을 시작합니다...")

try:
    response = dynamodb.create_table(
        TableName=table_name,
        BillingMode='PAY_PER_REQUEST',
        AttributeDefinitions=[
            {'AttributeName': 'roomId', 'AttributeType': 'S'},
            {'AttributeName': 'status', 'AttributeType': 'S'},
            {'AttributeName': 'createdAt', 'AttributeType': 'S'}
        ],
        KeySchema=[
            {'AttributeName': 'roomId', 'KeyType': 'HASH'} # PK
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'status-createdAt-index',
                'KeySchema': [
                    {'AttributeName': 'status', 'KeyType': 'HASH'},
                    {'AttributeName': 'createdAt', 'KeyType': 'RANGE'}
                ],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ]
    )
    print(f"✅ 테이블 생성 대성공! 테이블 이름: {table_name}")
except Exception as e:
    print(f"❌ 에러 발생: {e}")
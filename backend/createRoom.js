// backend/createRoom.js

module.exports.handler = async (event) => {
  try {
    // 프론트엔드에서 보낸 데이터(Body) 꺼내기
    const body = JSON.parse(event.body);

    // (💡 나중에 이 부분에 DynamoDB에 데이터를 저장하는 진짜 코드가 들어갈 겁니다!)
    
    // 임시로 랜덤 방 번호 생성
    const randomRoomId = "room_" + Math.random().toString(36).substr(2, 9);

    // 성공 응답(Response) 뱉어주기
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // CORS 허용 (프론트엔드 연동용)
      },
      body: JSON.stringify({
        roomId: randomRoomId,
        status: "ACTIVE",
        message: "스터디룸이 성공적으로 생성되었습니다!",
        receivedData: body // 우리가 보낸 데이터가 잘 들어왔는지 확인용
      }),
    };
  } catch (error) {
    // 에러가 났을 때의 처리
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "서버 에러가 발생했습니다.", error: error.message }),
    };
  }
};
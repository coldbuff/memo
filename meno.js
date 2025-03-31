const fs = require('fs');
const readline = require('readline');
const path = require('path');
const http = require('http');
const https = require('https');

// 메모를 저장할 디렉토리 설정
const MEMO_DIR = path.join(__dirname, 'nodeapp', 'memos');

// 메모 디렉토리가 없으면 생성
if (!fs.existsSync(MEMO_DIR)) {
  fs.mkdirSync(MEMO_DIR, { recursive: true });
}

// 현재 시간을 포맷팅하는 함수
function getFormattedDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
}

// 메모 생성 함수
function createMemo(title, content) {
  const timestamp = getFormattedDateTime();
  const filename = `${timestamp}_${title}.txt`;
  const filePath = path.join(MEMO_DIR, filename);
  
  fs.writeFileSync(filePath, content);
  console.log(`메모가 저장되었습니다: ${filename}`);
  return filename;
}

// 메모 목록 가져오기 함수
function getMemoList() {
  if (!fs.existsSync(MEMO_DIR)) {
    return [];
  }
  
  return fs.readdirSync(MEMO_DIR)
    .filter(file => file.endsWith('.txt'))
    .map(file => {
      const filePath = path.join(MEMO_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        title: file.split('_').slice(1).join('_').replace('.txt', ''),
        createdAt: file.split('_')[0],
        size: stats.size
      };
    });
}

// 메모 내용 읽기 함수
function readMemo(filename) {
  const filePath = path.join(MEMO_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log('해당 메모를 찾을 수 없습니다.');
    return null;
  }
  
  return fs.readFileSync(filePath, 'utf8');
}

// 메모 삭제 함수
function deleteMemo(filename) {
  const filePath = path.join(MEMO_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log('해당 메모를 찾을 수 없습니다.');
    return false;
  }
  
  fs.unlinkSync(filePath);
  console.log(`메모가 삭제되었습니다: ${filename}`);
  return true;
}

// EC2 서버 데이터 가져오기 함수
function fetchEC2Data(callback) {
  http.get('http://13.125.250.187/index.html', (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      callback(null, data);
    });
  }).on('error', (err) => {
    console.error('EC2 서버 연결 오류:', err.message);
    callback(err, null);
  });
}

// 웹 서버 설정
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    
    const memoList = getMemoList();
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>메모 애플리케이션</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .memo-list { margin-top: 20px; }
          .memo-item { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; }
          .memo-title { font-weight: bold; }
          .memo-date { color: #666; font-size: 0.8em; }
          .memo-content { margin-top: 10px; white-space: pre-wrap; }
          .ec2-section { margin-top: 30px; padding: 15px; background-color: #f5f5f5; border-radius: 5px; }
          .ec2-title { font-size: 1.2em; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>메모 애플리케이션</h1>
        <div class="memo-list">
    `;
    
    if (memoList.length === 0) {
      html += '<p>저장된 메모가 없습니다.</p>';
    } else {
      memoList.forEach(memo => {
        const content = readMemo(memo.filename);
        html += `
          <div class="memo-item">
            <div class="memo-title">${memo.title}</div>
            <div class="memo-date">${memo.createdAt}</div>
            <div class="memo-content">${content}</div>
          </div>
        `;
      });
    }
    
    html += `
        </div>
    `;
    
    // EC2 서버 데이터 가져와서 표시
    fetchEC2Data((err, ec2Data) => {
      if (err) {
        html += `
          <div class="ec2-section">
            <div class="ec2-title">EC2 서버 연결 오류</div>
            <p>EC2 서버(http://13.125.250.187/index.html)에 연결할 수 없습니다.</p>
            <p>오류: ${err.message}</p>
          </div>
        `;
      } else {
        // EC2 데이터에서 필요한 정보 추출 (간단한 예시)
        const title = ec2Data.includes('<title>') ? 
          ec2Data.split('<title>')[1].split('</title>')[0] : 'EC2 서버 데이터';
        
        html += `
          <div class="ec2-section">
            <div class="ec2-title">EC2 서버 데이터: ${title}</div>
            <p>EC2 서버 주소: <a href="http://13.125.250.187/index.html" target="_blank">http://13.125.250.187/index.html</a></p>
            <p><strong>참고:</strong> EC2 서버에는 별도의 To-Do 웹 애플리케이션이 실행 중입니다. 이 메모장 애플리케이션은 현재 로컬에서만 실행 중입니다.</p>
          </div>
        `;
      }
      
      html += `
      </body>
      </html>
      `;
      
      res.end(html);
    });
    
    return; // fetchEC2Data 콜백에서 응답을 처리하므로 여기서 함수 종료
    // 이 부분은 fetchEC2Data 콜백에서 처리됨
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('페이지를 찾을 수 없습니다.');
  }
});

// CLI 인터페이스 설정
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 메인 메뉴 표시
function showMainMenu() {
  console.log('\n===== 메모 관리 =====');
  console.log('1. 새 메모 작성');
  console.log('2. 메모 목록 보기');
  console.log('3. 메모 읽기');
  console.log('4. 메모 삭제');
  console.log('5. 종료');
  rl.question('원하는 작업을 선택하세요 (1-5): ', handleMainMenuChoice);
}

// 메인 메뉴 선택 처리
function handleMainMenuChoice(choice) {
  switch (choice) {
    case '1':
      showCreateMemoMenu();
      break;
    case '2':
      showMemoList();
      break;
    case '3':
      showReadMemoMenu();
      break;
    case '4':
      showDeleteMemoMenu();
      break;
    case '5':
      console.log('프로그램을 종료합니다.');
      rl.close();
      server.close();
      process.exit(0);
      break;
    default:
      console.log('잘못된 선택입니다. 다시 시도하세요.');
      showMainMenu();
  }
}

// 새 메모 작성 메뉴
function showCreateMemoMenu() {
  console.log('\n===== 간단한 메모장 =====');
  rl.question('메모 제목을 입력하세요: ', (title) => {
    if (!title.trim()) {
      console.log('제목은 필수입니다. 메인 메뉴로 돌아갑니다.');
      showMainMenu();
      return;
    }
    
    rl.question('메모 내용을 입력하세요: ', (content) => {
      if (!content.trim()) {
        console.log('내용은 필수입니다. 메인 메뉴로 돌아갑니다.');
        showMainMenu();
        return;
      }
      
      const filename = createMemo(title, content);
      showMainMenu();
    });
  });
}

// 메모 목록 표시
function showMemoList() {
  console.log('\n===== 메모 목록 =====');
  const memos = getMemoList();
  
  if (memos.length === 0) {
    console.log('저장된 메모가 없습니다.');
  } else {
    memos.forEach((memo, index) => {
      console.log(`${index + 1}. ${memo.title} (${memo.createdAt})`);
    });
  }
  
  showMainMenu();
}

// 메모 읽기 메뉴
function showReadMemoMenu() {
  console.log('\n===== 간단한 메모장 =====');
  const memos = getMemoList();
  
  if (memos.length === 0) {
    console.log('저장된 메모가 없습니다.');
    showMainMenu();
    return;
  }
  
  console.log('===== 메모 목록 =====');
  memos.forEach((memo, index) => {
    console.log(`${index + 1}. ${memo.title}`);
  });
  
  rl.question(`원하는 메모를 선택하세요 (1-${memos.length}): `, (choice) => {
    const index = parseInt(choice) - 1;
    
    if (isNaN(index) || index < 0 || index >= memos.length) {
      console.log('잘못된 선택입니다. 메인 메뉴로 돌아갑니다.');
      showMainMenu();
      return;
    }
    
    const memo = memos[index];
    const content = readMemo(memo.filename);
    
    console.log('\n===== 메모 내용 =====');
    console.log(`제목: ${memo.title}`);
    console.log(`작성일: ${memo.createdAt}`);
    console.log('내용:');
    console.log(content);
    
    showMainMenu();
  });
}

// 메모 삭제 메뉴
function showDeleteMemoMenu() {
  console.log('\n===== 간단한 메모장 =====');
  const memos = getMemoList();
  
  if (memos.length === 0) {
    console.log('저장된 메모가 없습니다.');
    showMainMenu();
    return;
  }
  
  console.log('===== 메모 목록 =====');
  memos.forEach((memo, index) => {
    console.log(`${index + 1}. ${memo.title}`);
  });
  
  rl.question(`삭제할 메모를 선택하세요 (1-${memos.length}): `, (choice) => {
    const index = parseInt(choice) - 1;
    
    if (isNaN(index) || index < 0 || index >= memos.length) {
      console.log('잘못된 선택입니다. 메인 메뉴로 돌아갑니다.');
      showMainMenu();
      return;
    }
    
    const memo = memos[index];
    
    rl.question(`정말로 '${memo.title}' 메모를 삭제하시겠습니까? (y/n): `, (confirm) => {
      if (confirm.toLowerCase() === 'y') {
        deleteMemo(memo.filename);
      } else {
        console.log('메모 삭제가 취소되었습니다.');
      }
      
      showMainMenu();
    });
  });
}

// 서버 시작
const PORT = process.env.PORT || 3000; // 환경 변수로 포트 설정 가능
server.listen(PORT, '0.0.0.0', () => { // 0.0.0.0으로 모든 인터페이스에서 접속 가능
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다...`);
  console.log('간단한 메모장 애플리케이션을 시작합니다...');
  console.log('===== EC2 서버 배포 안내 =====');
  console.log('1. 파일을 EC2 서버로 전송: scp -i [key.pem] meno.js ec2-user@13.125.250.187:/home/ec2-user/');
  console.log('2. 디렉토리 생성: mkdir -p /home/ec2-user/nodeapp/memos');
  console.log('3. 애플리케이션 실행: cd /home/ec2-user && node meno.js');
  console.log('4. EC2 보안 그룹에서 포트 3000 열기');
  showMainMenu();
});

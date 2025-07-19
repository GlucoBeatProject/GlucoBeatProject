#!/usr/bin/env node

/**
 * OpenAPS SMB & Temporary Basal Calculator Server
 * 시작 스크립트
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 OpenAPS SMB & Temporary Basal Calculator 시작 중...\n');

// 필요한 디렉토리와 파일 확인
const serverPath = path.join(__dirname, 'lib', 'server.js');
const packagePath = path.join(__dirname, 'package.json');

if (!fs.existsSync(serverPath)) {
    console.error('❌ 오류: lib/server.js 파일을 찾을 수 없습니다.');
    console.error('   현재 디렉토리가 올바른지 확인하세요.');
    process.exit(1);
}

if (!fs.existsSync(packagePath)) {
    console.error('❌ 오류: package.json 파일을 찾을 수 없습니다.');
    console.error('   npm install을 먼저 실행하세요.');
    process.exit(1);
}

// 서버 시작
console.log('📦 서버 파일 확인 완료');
console.log('🔧 Node.js 프로세스 시작 중...');
console.log('📍 서버 위치:', serverPath);
console.log('🌐 접속 URL: http://localhost:5000');
console.log('📚 API 문서: /calculate 엔드포인트 사용 가능');
console.log('📋 테스트: node test_calculate_endpoint.js\n');

// 서버 프로세스 시작
const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: path.dirname(serverPath)
});

// 프로세스 종료 처리
serverProcess.on('close', (code) => {
    if (code !== 0) {
        console.error(`\n❌ 서버가 오류와 함께 종료되었습니다. (종료 코드: ${code})`);
        process.exit(code);
    } else {
        console.log('\n✅ 서버가 정상적으로 종료되었습니다.');
    }
});

serverProcess.on('error', (err) => {
    console.error('\n❌ 서버 시작 오류:', err);
    process.exit(1);
});

// Ctrl+C 처리
process.on('SIGINT', () => {
    console.log('\n🛑 종료 신호를 받았습니다. 서버를 종료합니다...');
    serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 종료 신호를 받았습니다. 서버를 종료합니다...');
    serverProcess.kill('SIGTERM');
});

// 시작 메시지
setTimeout(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 OpenAPS 서버가 실행 중입니다!');
    console.log('📡 API 엔드포인트:');
    console.log('   POST http://localhost:5000/calculate - SMB & 베이설 계산');
    console.log('   POST http://localhost:5000/trio - 기존 엔드포인트');
    console.log('');
    console.log('📝 사용법:');
    console.log('   1. 다른 터미널에서: node test_calculate_endpoint.js');
    console.log('   2. HTTP 클라이언트로 /calculate 엔드포인트 호출');
    console.log('   3. API_DOCUMENTATION.md 참조');
    console.log('');
    console.log('⚠️  주의: 교육/연구 목적으로만 사용하세요!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}, 2000); 
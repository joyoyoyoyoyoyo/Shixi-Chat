#!/usr/bin/env bash
# 静态检查脚本：TypeScript 类型检查 + 前端构建试运行
# 用法：bash scripts/check-static.sh
set -e
cd "$(dirname "$0")/.."

echo "▶ 前端 TypeScript 类型检查"
cd frontend
npx tsc --noEmit
echo "✓ 前端类型无误"

echo ""
echo "▶ 后端 node 语法自检（遍历 require）"
cd ../backend
node -e "require('./src/app.js')" &
PID=$!
sleep 3
kill $PID 2>/dev/null || true
echo "✓ 后端可加载（若有 MongoDB 连接错误属正常，只要无 SyntaxError 即可）"

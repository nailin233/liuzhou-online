/**
 * Blender 测试模型验证脚本
 * Issue #16: 验证 Blender MCP 环境并生成测试模型
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const modelPath = join(projectRoot, 'tests', 'blender-test-model.glb');

test('blender test model file exists', () => {
  assert.ok(
    existsSync(modelPath),
    `测试模型文件应该存在: ${modelPath}\n` +
    `请先执行 Blender 脚本生成模型:\n` +
    `blender --background --python scripts/generate-test-model.py`
  );
});

test('model file size is reasonable', () => {
  if (!existsSync(modelPath)) {
    console.log('⚠️  跳过: 模型文件不存在');
    return;
  }
  
  const stats = statSync(modelPath);
  const sizeKB = stats.size / 1024;
  
  console.log(`  模型文件大小: ${sizeKB.toFixed(2)} KB`);
  
  assert.ok(
    sizeKB < 100,
    `模型文件大小应该 < 100KB, 实际: ${sizeKB.toFixed(2)} KB`
  );
  
  assert.ok(
    sizeKB > 0.1,
    `模型文件大小应该 > 0.1KB (文件不应该为空), 实际: ${sizeKB.toFixed(2)} KB`
  );
});

test('model file is valid GLB format', () => {
  if (!existsSync(modelPath)) {
    console.log('⚠️  跳过: 模型文件不存在');
    return;
  }
  
  const buffer = readFileSync(modelPath);
  
  // GLB 文件以 "glTF" 魔数开头 (0x676C5446)
  const magic = buffer.readUInt32LE(0);
  const expectedMagic = 0x46546C67; // "glTF" in little-endian
  
  assert.equal(
    magic,
    expectedMagic,
    `GLB 文件应该以 "glTF" 魔数开头, 实际: 0x${magic.toString(16)}`
  );
  
  // 检查 GLB 版本 (应该是 2)
  const version = buffer.readUInt32LE(4);
  assert.equal(
    version,
    2,
    `GLB 版本应该是 2 (glTF 2.0), 实际: ${version}`
  );
  
  console.log('  ✅ GLB 格式验证通过');
  console.log(`     魔数: 0x${magic.toString(16)} (glTF)`);
  console.log(`     版本: ${version}`);
});

test('model specifications are documented', () => {
  const scriptPath = join(projectRoot, 'scripts', 'generate-test-model.py');
  const setupDocPath = join(projectRoot, 'docs', 'blender-mcp-setup.md');
  
  assert.ok(
    existsSync(scriptPath),
    'Blender 生成脚本应该存在'
  );
  
  assert.ok(
    existsSync(setupDocPath),
    'Blender MCP 配置文档应该存在'
  );
  
  // 验证脚本中包含正确的规格
  const scriptContent = readFileSync(scriptPath, 'utf8');
  
  assert.ok(
    scriptContent.includes('width=10'),
    '脚本应该指定宽度为 10m'
  );
  
  assert.ok(
    scriptContent.includes('height=15'),
    '脚本应该指定高度为 15m'
  );
  
  assert.ok(
    scriptContent.includes('#C9D2D6'),
    '脚本应该使用正确的立面颜色 #C9D2D6'
  );
  
  assert.ok(
    scriptContent.includes('#E4EBED'),
    '脚本应该使用正确的顶面颜色 #E4EBED'
  );
  
  assert.ok(
    scriptContent.includes('0.85'),
    '脚本应该设置 roughness = 0.85'
  );
  
  console.log('  ✅ 模型规格文档验证通过');
});

test('color specifications match art direction', () => {
  const artDirectionPath = join(projectRoot, 'docs', 'art-direction.md');
  
  if (!existsSync(artDirectionPath)) {
    console.log('⚠️  跳过: 美术规范文档不存在');
    return;
  }
  
  const artDoc = readFileSync(artDirectionPath, 'utf8');
  
  // 验证颜色编码表存在
  assert.ok(
    artDoc.includes('osm.height'),
    '美术规范应该包含 osm.height 颜色编码'
  );
  
  assert.ok(
    artDoc.includes('#C9D2D6'),
    '美术规范应该包含立面颜色 #C9D2D6'
  );
  
  assert.ok(
    artDoc.includes('#E4EBED'),
    '美术规范应该包含顶面颜色 #E4EBED'
  );
  
  assert.ok(
    artDoc.includes('roughness = 0.85'),
    '美术规范应该指定建筑 roughness = 0.85'
  );
  
  console.log('  ✅ 颜色规格与美术规范一致');
});

test('model can be loaded in Three.js environment (stub)', () => {
  // 这个测试需要在浏览器或 Node.js + Three.js 环境中运行
  // 这里只验证必要的文件存在
  
  const mainTsPath = join(projectRoot, 'src', 'main.ts');
  
  assert.ok(
    existsSync(mainTsPath),
    'Three.js 入口文件应该存在'
  );
  
  console.log('  ℹ️  Three.js 加载测试需要在浏览器环境中运行');
  console.log('     提示: npm run dev 后在浏览器中手动测试');
});

import { parseSpec } from './dist/pipeline/parser/index.js';

async function test() {
  try {
    console.log('Testing parser...');
    const result = await parseSpec('test/fixtures/petstore.yaml');
    console.log('Parser result:', result.info.title);
  } catch (error) {
    console.error('Parser error:', error);
  }
}

test();
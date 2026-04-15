import { buildPipeline } from './dist/pipeline/index.js';

async function test() {
  try {
    console.log('Creating pipeline...');
    const pipeline = buildPipeline();
    console.log('Pipeline created successfully');

    console.log('Running pipeline...');
    await pipeline.run({
      specSource: 'test/fixtures/petstore.yaml',
      outputDir: './test-output',
      options: {}
    });
    console.log('Pipeline run completed successfully');
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
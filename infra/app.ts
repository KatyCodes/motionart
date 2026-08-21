import { App } from 'aws-cdk-lib';
import { MotionArtInfrastructureStack } from './MotionArtInfrastructureStack';

const app = new App();

new MotionArtInfrastructureStack(app, 'MotionArtDevelopment', {
  description: 'Development storage, queueing, and cost safeguards for Motion Art.',
});

app.synth();

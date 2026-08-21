import {
  CfnOutput,
  CfnParameter,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from 'aws-cdk-lib';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import {
  AttributeType,
  BillingMode,
  Table,
  TableEncryption,
} from 'aws-cdk-lib/aws-dynamodb';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export class MotionArtInfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    Tags.of(this).add('Environment', 'development');
    Tags.of(this).add('Project', 'MotionArt');

    const budgetAlertEmail = new CfnParameter(this, 'BudgetAlertEmail', {
      type: 'String',
      description: 'Email address that receives the development AWS cost alert.',
      allowedPattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
      constraintDescription: 'Enter a valid email address.',
    });

    const artifactBucket = new Bucket(this, 'RenderArtifactBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{
        id: 'ExpireTemporaryPreviews',
        prefix: 'previews/',
        expiration: Duration.days(7),
        abortIncompleteMultipartUploadAfter: Duration.days(1),
      }],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const jobTable = new Table(this, 'RenderJobTable', {
      partitionKey: { name: 'jobId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const deadLetterQueue = new Queue(this, 'RenderDeadLetterQueue', {
      encryption: QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
    });
    const renderQueue = new Queue(this, 'RenderQueue', {
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue,
      },
      encryption: QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(4),
      visibilityTimeout: Duration.minutes(15),
    });

    new CfnBudget(this, 'DevelopmentCostBudget', {
      budget: {
        budgetLimit: { amount: 10, unit: 'USD' },
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
      },
      notificationsWithSubscribers: [{
        notification: {
          comparisonOperator: 'GREATER_THAN',
          notificationType: 'ACTUAL',
          threshold: 80,
          thresholdType: 'PERCENTAGE',
        },
        subscribers: [{
          address: budgetAlertEmail.valueAsString,
          subscriptionType: 'EMAIL',
        }],
      }],
    });

    new CfnOutput(this, 'ArtifactBucketName', { value: artifactBucket.bucketName });
    new CfnOutput(this, 'RenderJobTableName', { value: jobTable.tableName });
    new CfnOutput(this, 'RenderQueueUrl', { value: renderQueue.queueUrl });
    new CfnOutput(this, 'RenderDeadLetterQueueUrl', { value: deadLetterQueue.queueUrl });
  }
}

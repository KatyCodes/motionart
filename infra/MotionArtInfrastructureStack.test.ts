import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { MotionArtInfrastructureStack } from './MotionArtInfrastructureStack';

function createTemplate(): Template {
  const app = new App();
  const stack = new MotionArtInfrastructureStack(app, 'MotionArtDevelopment');
  return Template.fromStack(stack);
}

describe('MotionArtInfrastructureStack', () => {
  it('keeps rendered artifacts encrypted, private, HTTPS-only, and temporary', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [{
          ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' },
        }],
      },
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Id: 'ExpireTemporaryPreviews',
            Prefix: 'previews/',
            Status: 'Enabled',
            ExpirationInDays: 7,
          }),
        ]),
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:*',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
            Effect: 'Deny',
          }),
        ]),
      },
    });
  });

  it('creates an encrypted on-demand job table with expiry metadata', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::DynamoDB::Table', 1);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: 'jobId', KeyType: 'HASH' }],
      SSESpecification: { SSEEnabled: true },
      TimeToLiveSpecification: {
        AttributeName: 'expiresAt',
        Enabled: true,
      },
    });
  });

  it('retries queued renders before isolating repeated failures', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::SQS::Queue', 2);
    template.hasResourceProperties('AWS::SQS::Queue', {
      MessageRetentionPeriod: 345600,
      RedrivePolicy: Match.objectLike({ maxReceiveCount: 3 }),
      SqsManagedSseEnabled: true,
      VisibilityTimeout: 900,
    });
  });

  it('requires a monthly cost alert before the first deployment', () => {
    const template = createTemplate();

    template.resourceCountIs('AWS::Budgets::Budget', 1);
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: {
        BudgetLimit: { Amount: 10, Unit: 'USD' },
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
      },
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({
            ComparisonOperator: 'GREATER_THAN',
            NotificationType: 'ACTUAL',
            Threshold: 80,
            ThresholdType: 'PERCENTAGE',
          }),
          Subscribers: Match.arrayWith([
            Match.objectLike({ SubscriptionType: 'EMAIL' }),
          ]),
        }),
      ]),
    });
  });

  it('labels every resource as a development Motion Art resource', () => {
    const resources = createTemplate().toJSON().Resources as Record<
      string,
      { Properties?: { Tags?: Array<{ Key: string; Value: string }> } }
    >;
    const tagSets = Object.values(resources)
      .map((resource) => resource.Properties?.Tags)
      .filter((tags) => tags !== undefined);

    expect(tagSets.length).toBeGreaterThan(0);
    for (const tags of tagSets) {
      expect(tags).toEqual(expect.arrayContaining([
        { Key: 'Environment', Value: 'development' },
        { Key: 'Project', Value: 'MotionArt' },
      ]));
    }
  });
});

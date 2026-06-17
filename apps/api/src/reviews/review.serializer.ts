import type { ContractorReview } from '../generated/prisma/client';

export function toReviewView(review: ContractorReview) {
  return {
    id: review.id,
    jobId: review.jobId,
    contractorUserId: review.contractorUserId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}

type ReviewWithContext = ContractorReview & {
  job: { title: string };
  reviewer: { firstName: string; lastName: string };
};

export function toPublicReviewView(review: ReviewWithContext) {
  const lastInitial = review.reviewer.lastName.trim().charAt(0);
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    jobTitle: review.job.title,
    reviewerName: lastInitial
      ? `${review.reviewer.firstName.trim()} ${lastInitial}.`
      : review.reviewer.firstName.trim(),
  };
}

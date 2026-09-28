export type AuditActor = {
  id: number;
  username: string;
  displayName: string;
};

type ActivityDetails = {
  type: string;
  title: string;
  description: string;
  amount: string | number;
};

export function signedActivity(actor: AuditActor, details: ActivityDetails) {
  return {
    ...details,
    amount: String(details.amount),
    actorUserId: actor.id,
    actorUsername: actor.username,
    actorDisplayName: actor.displayName,
  };
}
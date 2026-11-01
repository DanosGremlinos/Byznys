import { relations } from "drizzle-orm";
import {
  dunningRuns,
  dunningSteps,
  invoices,
  subscriptionEvents,
  subscriptionTiers,
  subscriptions,
} from "./billing";
import { builderAssets, builderProjects, builderPromptVersions } from "./builder";
import { clients, websites } from "./clients";
import { jobs } from "./jobs";
import { leadPhotos, leadReviews, leadSiteAnalyses, leads } from "./leads";
import {
  contractTemplates,
  contracts,
  emailAttachments,
  emailTemplates,
  emailThreads,
  emails,
} from "./messaging";

export const jobsRelations = relations(jobs, ({ many }) => ({ leads: many(leads) }));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  searchJob: one(jobs, { fields: [leads.searchJobId], references: [jobs.id] }),
  photos: many(leadPhotos),
  reviews: many(leadReviews),
  siteAnalyses: many(leadSiteAnalyses),
  clients: many(clients),
  threads: many(emailThreads),
  builderProjects: many(builderProjects),
}));

export const leadPhotosRelations = relations(leadPhotos, ({ one }) => ({
  lead: one(leads, { fields: [leadPhotos.leadId], references: [leads.id] }),
}));
export const leadReviewsRelations = relations(leadReviews, ({ one }) => ({
  lead: one(leads, { fields: [leadReviews.leadId], references: [leads.id] }),
}));
export const leadSiteAnalysesRelations = relations(leadSiteAnalyses, ({ one }) => ({
  lead: one(leads, { fields: [leadSiteAnalyses.leadId], references: [leads.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  lead: one(leads, { fields: [clients.leadId], references: [leads.id] }),
  websites: many(websites),
  subscriptions: many(subscriptions),
  invoices: many(invoices),
  threads: many(emailThreads),
  contracts: many(contracts),
}));

export const websitesRelations = relations(websites, ({ one, many }) => ({
  client: one(clients, { fields: [websites.clientId], references: [clients.id] }),
  subscription: one(subscriptions),
  builderProjects: many(builderProjects),
}));

export const builderProjectsRelations = relations(builderProjects, ({ one, many }) => ({
  lead: one(leads, { fields: [builderProjects.leadId], references: [leads.id] }),
  website: one(websites, { fields: [builderProjects.websiteId], references: [websites.id] }),
  assets: many(builderAssets),
  promptVersions: many(builderPromptVersions),
}));
export const builderAssetsRelations = relations(builderAssets, ({ one }) => ({
  project: one(builderProjects, { fields: [builderAssets.projectId], references: [builderProjects.id] }),
  leadPhoto: one(leadPhotos, { fields: [builderAssets.leadPhotoId], references: [leadPhotos.id] }),
  leadReview: one(leadReviews, { fields: [builderAssets.leadReviewId], references: [leadReviews.id] }),
}));
export const builderPromptVersionsRelations = relations(builderPromptVersions, ({ one }) => ({
  project: one(builderProjects, {
    fields: [builderPromptVersions.projectId],
    references: [builderProjects.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({ emails: many(emails) }));
export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  client: one(clients, { fields: [emailThreads.clientId], references: [clients.id] }),
  lead: one(leads, { fields: [emailThreads.leadId], references: [leads.id] }),
  emails: many(emails),
}));
export const emailsRelations = relations(emails, ({ one, many }) => ({
  thread: one(emailThreads, { fields: [emails.threadId], references: [emailThreads.id] }),
  template: one(emailTemplates, { fields: [emails.templateId], references: [emailTemplates.id] }),
  attachments: many(emailAttachments),
}));
export const emailAttachmentsRelations = relations(emailAttachments, ({ one }) => ({
  email: one(emails, { fields: [emailAttachments.emailId], references: [emails.id] }),
}));
export const contractTemplatesRelations = relations(contractTemplates, ({ many }) => ({
  contracts: many(contracts),
}));
export const contractsRelations = relations(contracts, ({ one }) => ({
  client: one(clients, { fields: [contracts.clientId], references: [clients.id] }),
  website: one(websites, { fields: [contracts.websiteId], references: [websites.id] }),
  template: one(contractTemplates, { fields: [contracts.templateId], references: [contractTemplates.id] }),
}));

export const subscriptionTiersRelations = relations(subscriptionTiers, ({ many }) => ({
  subscriptions: many(subscriptions),
}));
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  client: one(clients, { fields: [subscriptions.clientId], references: [clients.id] }),
  website: one(websites, { fields: [subscriptions.websiteId], references: [websites.id] }),
  tier: one(subscriptionTiers, { fields: [subscriptions.tierId], references: [subscriptionTiers.id] }),
  events: many(subscriptionEvents),
  invoices: many(invoices),
}));
export const subscriptionEventsRelations = relations(subscriptionEvents, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionEvents.subscriptionId],
    references: [subscriptions.id],
  }),
  client: one(clients, { fields: [subscriptionEvents.clientId], references: [clients.id] }),
  fromTier: one(subscriptionTiers, {
    fields: [subscriptionEvents.fromTierId],
    references: [subscriptionTiers.id],
    relationName: "fromTier",
  }),
  toTier: one(subscriptionTiers, {
    fields: [subscriptionEvents.toTierId],
    references: [subscriptionTiers.id],
    relationName: "toTier",
  }),
}));
export const invoicesRelations = relations(invoices, ({ one }) => ({
  subscription: one(subscriptions, { fields: [invoices.subscriptionId], references: [subscriptions.id] }),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  dunningRun: one(dunningRuns),
}));
export const dunningRunsRelations = relations(dunningRuns, ({ one, many }) => ({
  invoice: one(invoices, { fields: [dunningRuns.invoiceId], references: [invoices.id] }),
  steps: many(dunningSteps),
}));
export const dunningStepsRelations = relations(dunningSteps, ({ one }) => ({
  run: one(dunningRuns, { fields: [dunningSteps.runId], references: [dunningRuns.id] }),
  email: one(emails, { fields: [dunningSteps.emailId], references: [emails.id] }),
}));

import { relations, sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";
import { projects } from "./projects.js";

// "pending_review" attend la validation d'un admin ; "rejected" porte sa
// raison dans reviewNote. La phase d'une compétition publiée n'est jamais
// stockée : elle se dérive des trois échéances (computeCompetitionPhase).
export const competitionStatusEnum = pgEnum("competition_status", ["pending_review", "rejected", "published"]);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    status: competitionStatusEnum("status").notNull().default("pending_review"),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    pitch: text("pitch").notNull(),
    description: text("description").notNull().default(""),
    registrationClosesAt: timestamp("registration_closes_at").notNull(),
    submissionClosesAt: timestamp("submission_closes_at").notNull(),
    votingClosesAt: timestamp("voting_closes_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("competitions_status_created_idx").on(table.status, table.createdAt),
    check(
      "competitions_phases_in_order",
      sql`${table.registrationClosesAt} < ${table.submissionClosesAt} and ${table.submissionClosesAt} < ${table.votingClosesAt}`,
    ),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    captainId: uuid("captain_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("teams_competition_name_idx").on(table.competitionId, table.name)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    // Dénormalisé depuis teams.competitionId : une personne ne peut
    // rejoindre qu'une seule équipe par compétition, contrainte qu'un index
    // unique sur (team_id, profile_id) seul ne peut pas exprimer.
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("team_members_competition_profile_idx").on(table.competitionId, table.profileId)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .unique()
      .references(() => teams.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    // Le projet reste à son auteur, la soumission y pointe. Son contenu est
    // rédigé à part : l'auteur choisit ce qu'il montre à cette compétition.
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    pitch: text("pitch").notNull(),
    description: text("description").notNull().default(""),
    repoUrl: text("repo_url").notNull(),
    demoUrl: text("demo_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("submissions_competition_created_idx").on(table.competitionId, table.createdAt)],
);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Un seul choix par personne et par compétition (le vote public élit un
    // favori, il ne distribue pas des mentions "j'aime"). Changer d'avis
    // avant la fin du vote met à jour cette même ligne (castVote).
    uniqueIndex("votes_competition_voter_idx").on(table.competitionId, table.voterId),
    index("votes_submission_idx").on(table.submissionId),
  ],
);

export const juryScores = pgTable(
  "jury_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    jurorId: uuid("juror_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Sur 20, comme une notation scolaire déjà familière au public visé.
    score: integer("score").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("jury_scores_submission_juror_idx").on(table.submissionId, table.jurorId),
    check("jury_scores_score_range", sql`${table.score} >= 0 and ${table.score} <= 20`),
  ],
);

export const competitionsRelations = relations(competitions, ({ one, many }) => ({
  creator: one(profiles, { fields: [competitions.createdBy], references: [profiles.id] }),
  reviewer: one(profiles, { fields: [competitions.reviewedBy], references: [profiles.id] }),
  teams: many(teams),
  submissions: many(submissions),
  votes: many(votes),
  juryScores: many(juryScores),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  competition: one(competitions, { fields: [teams.competitionId], references: [competitions.id] }),
  captain: one(profiles, { fields: [teams.captainId], references: [profiles.id] }),
  members: many(teamMembers),
  submission: one(submissions, { fields: [teams.id], references: [submissions.teamId] }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  competition: one(competitions, { fields: [teamMembers.competitionId], references: [competitions.id] }),
  profile: one(profiles, { fields: [teamMembers.profileId], references: [profiles.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  team: one(teams, { fields: [submissions.teamId], references: [teams.id] }),
  competition: one(competitions, { fields: [submissions.competitionId], references: [competitions.id] }),
  project: one(projects, { fields: [submissions.projectId], references: [projects.id] }),
  author: one(profiles, { fields: [submissions.authorId], references: [profiles.id] }),
  votes: many(votes),
  juryScores: many(juryScores),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  competition: one(competitions, { fields: [votes.competitionId], references: [competitions.id] }),
  submission: one(submissions, { fields: [votes.submissionId], references: [submissions.id] }),
  voter: one(profiles, { fields: [votes.voterId], references: [profiles.id] }),
}));

export const juryScoresRelations = relations(juryScores, ({ one }) => ({
  competition: one(competitions, { fields: [juryScores.competitionId], references: [competitions.id] }),
  submission: one(submissions, { fields: [juryScores.submissionId], references: [submissions.id] }),
  juror: one(profiles, { fields: [juryScores.jurorId], references: [profiles.id] }),
}));

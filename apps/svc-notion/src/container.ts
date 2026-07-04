// Composition root — the only place that wires infrastructure into use-cases.
import {
  CommentUseCases,
  DatabaseUseCases,
  FavoriteUseCases,
  MembershipGuard,
  PageUseCases,
  UserUseCases,
  VersionUseCases,
  WorkspaceUseCases,
} from "./application/usecases"
import {
  PrismaCommentRepo,
  PrismaDatabaseRepo,
  PrismaFavoriteRepo,
  PrismaPageRepo,
  PrismaUserRepo,
  PrismaVersionRepo,
  PrismaWorkspaceRepo,
} from "./infrastructure/prisma-repositories"

const workspaceRepo = new PrismaWorkspaceRepo()
const pageRepo = new PrismaPageRepo()
const guard = new MembershipGuard(workspaceRepo, pageRepo)

export const users = new UserUseCases(new PrismaUserRepo())
export const workspaces = new WorkspaceUseCases(workspaceRepo)
export const pages = new PageUseCases(pageRepo, guard)
export const databases = new DatabaseUseCases(
  new PrismaDatabaseRepo(),
  pageRepo,
  pages,
  guard
)
export const comments = new CommentUseCases(new PrismaCommentRepo(), guard)
export const favorites = new FavoriteUseCases(new PrismaFavoriteRepo(), guard)
export const versions = new VersionUseCases(new PrismaVersionRepo(), pageRepo, guard)

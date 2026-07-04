import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { User as UserModel, Workspace as WorkspaceModel, Page as PageModel, PageSummary as PageSummaryModel, DatabaseDef as DatabaseDefModel, DatabaseView as DatabaseViewModel, Comment as CommentModel, Favorite as FavoriteModel, PageVersion as PageVersionModel } from '../../../domain/entities';
import { GraphQLContext } from '../context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: unknown; output: unknown; }
};

export type Comment = {
  __typename?: 'Comment';
  authorId: Scalars['ID']['output'];
  blockId?: Maybe<Scalars['ID']['output']>;
  body: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  pageId: Scalars['ID']['output'];
  parentId?: Maybe<Scalars['ID']['output']>;
  resolvedAt?: Maybe<Scalars['String']['output']>;
};

export type Database = {
  __typename?: 'Database';
  id: Scalars['ID']['output'];
  pageId: Scalars['ID']['output'];
  propertySchema: Scalars['JSON']['output'];
  views: Array<DatabaseView>;
};

export type DatabaseView = {
  __typename?: 'DatabaseView';
  config: Scalars['JSON']['output'];
  databaseId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  rank: Scalars['String']['output'];
  type: ViewType;
};

export type Favorite = {
  __typename?: 'Favorite';
  id: Scalars['ID']['output'];
  pageId: Scalars['ID']['output'];
  rank: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addDatabaseRow?: Maybe<Page>;
  addFavorite: Favorite;
  addView?: Maybe<DatabaseView>;
  createComment: Comment;
  createDatabase?: Maybe<Database>;
  createPage: Page;
  createWorkspace: Workspace;
  deleteComment: Scalars['Boolean']['output'];
  deleteView: Scalars['Boolean']['output'];
  duplicatePage?: Maybe<Page>;
  purgePage: Scalars['Boolean']['output'];
  removeFavorite: Scalars['Boolean']['output'];
  restorePage?: Maybe<Page>;
  restoreVersion?: Maybe<Page>;
  snapshotPage?: Maybe<PageVersion>;
  trashPage?: Maybe<Page>;
  updateComment?: Maybe<Comment>;
  updateDatabaseSchema?: Maybe<Database>;
  updatePage?: Maybe<Page>;
  updateView?: Maybe<DatabaseView>;
};


export type MutationAddDatabaseRowArgs = {
  databaseId: Scalars['ID']['input'];
  properties?: InputMaybe<Scalars['JSON']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};


export type MutationAddFavoriteArgs = {
  pageId: Scalars['ID']['input'];
};


export type MutationAddViewArgs = {
  config?: InputMaybe<Scalars['JSON']['input']>;
  databaseId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  type: ViewType;
};


export type MutationCreateCommentArgs = {
  blockId?: InputMaybe<Scalars['ID']['input']>;
  body: Scalars['String']['input'];
  pageId: Scalars['ID']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationCreateDatabaseArgs = {
  pageId: Scalars['ID']['input'];
  propertySchema: Scalars['JSON']['input'];
};


export type MutationCreatePageArgs = {
  content?: InputMaybe<Scalars['JSON']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  properties?: InputMaybe<Scalars['JSON']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateWorkspaceArgs = {
  name: Scalars['String']['input'];
};


export type MutationDeleteCommentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteViewArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDuplicatePageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationPurgePageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveFavoriteArgs = {
  pageId: Scalars['ID']['input'];
};


export type MutationRestorePageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRestoreVersionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSnapshotPageArgs = {
  pageId: Scalars['ID']['input'];
};


export type MutationTrashPageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateCommentArgs = {
  body?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  resolved?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationUpdateDatabaseSchemaArgs = {
  id: Scalars['ID']['input'];
  propertySchema: Scalars['JSON']['input'];
};


export type MutationUpdatePageArgs = {
  content?: InputMaybe<Scalars['JSON']['input']>;
  coverUrl?: InputMaybe<Scalars['String']['input']>;
  icon?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  properties?: InputMaybe<Scalars['JSON']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  visibility?: InputMaybe<Visibility>;
};


export type MutationUpdateViewArgs = {
  config?: InputMaybe<Scalars['JSON']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<ViewType>;
};

export type Page = {
  __typename?: 'Page';
  content?: Maybe<Scalars['JSON']['output']>;
  coverUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  createdById: Scalars['ID']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPublic: Scalars['Boolean']['output'];
  parentId?: Maybe<Scalars['ID']['output']>;
  properties?: Maybe<Scalars['JSON']['output']>;
  rank: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  visibility: Visibility;
  workspaceId: Scalars['ID']['output'];
};

/** Lightweight page for trees/search results — no content. */
export type PageSummary = {
  __typename?: 'PageSummary';
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  parentId?: Maybe<Scalars['ID']['output']>;
  rank: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type PageVersion = {
  __typename?: 'PageVersion';
  content?: Maybe<Scalars['JSON']['output']>;
  createdAt: Scalars['String']['output'];
  createdById: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  pageId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  comments: Array<Comment>;
  database?: Maybe<Database>;
  databaseByPage?: Maybe<Database>;
  databaseRows: Array<Page>;
  favorites: Array<Favorite>;
  me?: Maybe<User>;
  page?: Maybe<Page>;
  pages: Array<PageSummary>;
  /** Public share link — no auth, returns the page only when isPublic. */
  publicPage?: Maybe<Page>;
  search: Array<PageSummary>;
  trash: Array<PageSummary>;
  versions: Array<PageVersion>;
  workspaces: Array<Workspace>;
};


export type QueryCommentsArgs = {
  pageId: Scalars['ID']['input'];
};


export type QueryDatabaseArgs = {
  id: Scalars['ID']['input'];
};


export type QueryDatabaseByPageArgs = {
  pageId: Scalars['ID']['input'];
};


export type QueryDatabaseRowsArgs = {
  databaseId: Scalars['ID']['input'];
  viewId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryPageArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPagesArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryPublicPageArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySearchArgs = {
  query: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QueryTrashArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryVersionsArgs = {
  pageId: Scalars['ID']['input'];
};

export type User = {
  __typename?: 'User';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  image?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type ViewType =
  | 'BOARD'
  | 'CALENDAR'
  | 'GALLERY'
  | 'LIST'
  | 'TABLE';

export type Visibility =
  | 'PRIVATE'
  | 'WORKSPACE';

export type Workspace = {
  __typename?: 'Workspace';
  createdAt: Scalars['String']['output'];
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Comment: ResolverTypeWrapper<CommentModel>;
  Database: ResolverTypeWrapper<DatabaseDefModel>;
  DatabaseView: ResolverTypeWrapper<DatabaseViewModel>;
  Favorite: ResolverTypeWrapper<FavoriteModel>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Page: ResolverTypeWrapper<PageModel>;
  PageSummary: ResolverTypeWrapper<PageSummaryModel>;
  PageVersion: ResolverTypeWrapper<PageVersionModel>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  User: ResolverTypeWrapper<UserModel>;
  ViewType: ViewType;
  Visibility: Visibility;
  Workspace: ResolverTypeWrapper<WorkspaceModel>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Boolean: Scalars['Boolean']['output'];
  Comment: CommentModel;
  Database: DatabaseDefModel;
  DatabaseView: DatabaseViewModel;
  Favorite: FavoriteModel;
  ID: Scalars['ID']['output'];
  JSON: Scalars['JSON']['output'];
  Mutation: Record<PropertyKey, never>;
  Page: PageModel;
  PageSummary: PageSummaryModel;
  PageVersion: PageVersionModel;
  Query: Record<PropertyKey, never>;
  String: Scalars['String']['output'];
  User: UserModel;
  Workspace: WorkspaceModel;
}>;

export type CommentResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Comment'] = ResolversParentTypes['Comment']> = ResolversObject<{
  authorId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  blockId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  body?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  pageId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  parentId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  resolvedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type DatabaseResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Database'] = ResolversParentTypes['Database']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  pageId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  propertySchema?: Resolver<ResolversTypes['JSON'], ParentType, ContextType>;
  views?: Resolver<Array<ResolversTypes['DatabaseView']>, ParentType, ContextType>;
}>;

export type DatabaseViewResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['DatabaseView'] = ResolversParentTypes['DatabaseView']> = ResolversObject<{
  config?: Resolver<ResolversTypes['JSON'], ParentType, ContextType>;
  databaseId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['ViewType'], ParentType, ContextType>;
}>;

export type FavoriteResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Favorite'] = ResolversParentTypes['Favorite']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  pageId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  addDatabaseRow?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<MutationAddDatabaseRowArgs, 'databaseId'>>;
  addFavorite?: Resolver<ResolversTypes['Favorite'], ParentType, ContextType, RequireFields<MutationAddFavoriteArgs, 'pageId'>>;
  addView?: Resolver<Maybe<ResolversTypes['DatabaseView']>, ParentType, ContextType, RequireFields<MutationAddViewArgs, 'databaseId' | 'name' | 'type'>>;
  createComment?: Resolver<ResolversTypes['Comment'], ParentType, ContextType, RequireFields<MutationCreateCommentArgs, 'body' | 'pageId'>>;
  createDatabase?: Resolver<Maybe<ResolversTypes['Database']>, ParentType, ContextType, RequireFields<MutationCreateDatabaseArgs, 'pageId' | 'propertySchema'>>;
  createPage?: Resolver<ResolversTypes['Page'], ParentType, ContextType, RequireFields<MutationCreatePageArgs, 'workspaceId'>>;
  createWorkspace?: Resolver<ResolversTypes['Workspace'], ParentType, ContextType, RequireFields<MutationCreateWorkspaceArgs, 'name'>>;
  deleteComment?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteCommentArgs, 'id'>>;
  deleteView?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteViewArgs, 'id'>>;
  duplicatePage?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<MutationDuplicatePageArgs, 'id'>>;
  purgePage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationPurgePageArgs, 'id'>>;
  removeFavorite?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRemoveFavoriteArgs, 'pageId'>>;
  restorePage?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<MutationRestorePageArgs, 'id'>>;
  restoreVersion?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<MutationRestoreVersionArgs, 'id'>>;
  snapshotPage?: Resolver<Maybe<ResolversTypes['PageVersion']>, ParentType, ContextType, RequireFields<MutationSnapshotPageArgs, 'pageId'>>;
  trashPage?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<MutationTrashPageArgs, 'id'>>;
  updateComment?: Resolver<Maybe<ResolversTypes['Comment']>, ParentType, ContextType, RequireFields<MutationUpdateCommentArgs, 'id'>>;
  updateDatabaseSchema?: Resolver<Maybe<ResolversTypes['Database']>, ParentType, ContextType, RequireFields<MutationUpdateDatabaseSchemaArgs, 'id' | 'propertySchema'>>;
  updatePage?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<MutationUpdatePageArgs, 'id'>>;
  updateView?: Resolver<Maybe<ResolversTypes['DatabaseView']>, ParentType, ContextType, RequireFields<MutationUpdateViewArgs, 'id'>>;
}>;

export type PageResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Page'] = ResolversParentTypes['Page']> = ResolversObject<{
  content?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  coverUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdById?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  icon?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isPublic?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  parentId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  properties?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  visibility?: Resolver<ResolversTypes['Visibility'], ParentType, ContextType>;
  workspaceId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
}>;

export type PageSummaryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['PageSummary'] = ResolversParentTypes['PageSummary']> = ResolversObject<{
  icon?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  parentId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  workspaceId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
}>;

export type PageVersionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['PageVersion'] = ResolversParentTypes['PageVersion']> = ResolversObject<{
  content?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdById?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  pageId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  comments?: Resolver<Array<ResolversTypes['Comment']>, ParentType, ContextType, RequireFields<QueryCommentsArgs, 'pageId'>>;
  database?: Resolver<Maybe<ResolversTypes['Database']>, ParentType, ContextType, RequireFields<QueryDatabaseArgs, 'id'>>;
  databaseByPage?: Resolver<Maybe<ResolversTypes['Database']>, ParentType, ContextType, RequireFields<QueryDatabaseByPageArgs, 'pageId'>>;
  databaseRows?: Resolver<Array<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<QueryDatabaseRowsArgs, 'databaseId'>>;
  favorites?: Resolver<Array<ResolversTypes['Favorite']>, ParentType, ContextType>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  page?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<QueryPageArgs, 'id'>>;
  pages?: Resolver<Array<ResolversTypes['PageSummary']>, ParentType, ContextType, RequireFields<QueryPagesArgs, 'workspaceId'>>;
  publicPage?: Resolver<Maybe<ResolversTypes['Page']>, ParentType, ContextType, RequireFields<QueryPublicPageArgs, 'id'>>;
  search?: Resolver<Array<ResolversTypes['PageSummary']>, ParentType, ContextType, RequireFields<QuerySearchArgs, 'query' | 'workspaceId'>>;
  trash?: Resolver<Array<ResolversTypes['PageSummary']>, ParentType, ContextType, RequireFields<QueryTrashArgs, 'workspaceId'>>;
  versions?: Resolver<Array<ResolversTypes['PageVersion']>, ParentType, ContextType, RequireFields<QueryVersionsArgs, 'pageId'>>;
  workspaces?: Resolver<Array<ResolversTypes['Workspace']>, ParentType, ContextType>;
}>;

export type UserResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = ResolversObject<{
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  image?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type WorkspaceResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Workspace'] = ResolversParentTypes['Workspace']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  icon?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  Comment?: CommentResolvers<ContextType>;
  Database?: DatabaseResolvers<ContextType>;
  DatabaseView?: DatabaseViewResolvers<ContextType>;
  Favorite?: FavoriteResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  Mutation?: MutationResolvers<ContextType>;
  Page?: PageResolvers<ContextType>;
  PageSummary?: PageSummaryResolvers<ContextType>;
  PageVersion?: PageVersionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  Workspace?: WorkspaceResolvers<ContextType>;
}>;


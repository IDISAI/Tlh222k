import "reflect-metadata"

import { plainToInstance } from "class-transformer"
import { ValidationPipe } from "@nestjs/common"
import { validate } from "class-validator"
import { describe, expect, it } from "vitest"

import { UpdateDocumentDto } from "../notion/dto"
import {
  CreateNodeDto,
  CreateRoadmapDto,
  SaveRoadmapDto,
  SetNodeStatusDto,
} from "./dto"

async function validationErrors<T extends object>(
  type: new () => T,
  body: Record<string, unknown>
) {
  return validate(plainToInstance(type, body), { forbidUnknownValues: false })
}

describe("roadmap request DTO validation", () => {
  it("rejects empty titles", async () => {
    const errors = await validationErrors(CreateRoadmapDto, {
      slug: "frontend",
      title: "   ",
    })
    expect(errors.length).toBeGreaterThan(0)
  })

  it("rejects invalid enum, URL, and non-finite coordinates", async () => {
    const errors = await validationErrors(CreateNodeDto, {
      roadmapId: "roadmap-a",
      title: "Node",
      nodeType: "executable",
      jupyterUrl: "file:///etc/passwd",
      positionX: Number.NaN,
      positionY: Number.POSITIVE_INFINITY,
    })
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        "nodeType",
        "jupyterUrl",
        "positionX",
        "positionY",
      ])
    )
  })

  it("rejects invalid progress status", async () => {
    const errors = await validationErrors(SetNodeStatusDto, {
      status: "complete",
    })
    expect(errors.some((error) => error.property === "status")).toBe(true)
  })

  it("rejects oversized arrays and strings", async () => {
    const saveErrors = await validationErrors(SaveRoadmapDto, {
      nodes: Array.from({ length: 501 }, (_, index) => ({
        id: `node-${index}`,
        parentId: null,
        positionX: 0,
        positionY: 0,
      })),
    })
    const notionErrors = await validationErrors(UpdateDocumentDto, {
      id: "doc-a",
      title: "x".repeat(201),
    })
    expect(saveErrors.some((error) => error.property === "nodes")).toBe(true)
    expect(notionErrors.some((error) => error.property === "title")).toBe(true)
  })

  it("forbids unknown body keys through the global pipe policy", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
    await expect(
      pipe.transform(
        { slug: "frontend", title: "Frontend", isAdmin: true },
        { type: "body", metatype: CreateRoadmapDto }
      )
    ).rejects.toThrow()
  })

  it("accepts valid bodies", async () => {
    const errors = await validationErrors(CreateNodeDto, {
      roadmapId: "roadmap-a",
      parentId: null,
      title: "Notebook",
      nodeType: "article",
      articleType: "jupyter",
      jupyterUrl: "https://notebooks.example.com/lab",
      positionX: 12.5,
      positionY: -4,
    })
    expect(errors).toEqual([])
  })
})

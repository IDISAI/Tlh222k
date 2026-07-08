"use client"

import { useState } from "react"
import type { UserRole } from "@workspace/core"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export interface ManagedUser {
  id: string
  email: string
  name: string
  imageUrl: string
  role: UserRole
}

const ROLES: UserRole[] = ["viewer", "admin", "super-admin"]

const BASE_PATH = process.env.NODE_ENV === "production" ? "/super-admin" : ""

export function UserTable({ users: initial }: { users: ManagedUser[] }) {
  const [users, setUsers] = useState(initial)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const changeRole = async (id: string, role: UserRole) => {
    const previous = users
    setError(null)
    setSavingId(id)
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
    try {
      const res = await fetch(`${BASE_PATH}/api/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch {
      setUsers(previous) // rollback
      setError("Không thể cập nhật quyền. Vui lòng thử lại.")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold uppercase italic">
          Quản lý người dùng
        </h1>
        <p className="text-sm text-muted-foreground">
          Gán quyền cho từng người dùng. Quyền lưu trong Clerk (publicMetadata).
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Quyền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Chưa có người dùng nào.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <select
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={(e) =>
                        void changeRole(u.id, e.target.value as UserRole)
                      }
                      className="rounded-md border bg-background px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

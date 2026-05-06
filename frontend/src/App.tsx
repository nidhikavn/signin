import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { LoaderCircle, LockKeyhole, LogOut, Save, X } from "lucide-react"

type User = {
  id: string
  name: string
  email: string
  role: string
  age: number | null
  salary: number | null
  createdAt: string
}

type ApiResponse = {
  message?: string
  user?: User
  employees?: User[]
}

const LOGIN_ROUTE = "/login"
const SIGNUP_ROUTE = "/signup"
const EMPLOYEES_ROUTE = "/employees"

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [employees, setEmployees] = useState<User[]>([])
  const [route, setRoute] = useState(() => window.location.pathname || LOGIN_ROUTE)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ name: string; age: number | null; salary: number | null }>({ name: "", age: null, salary: null })
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState("")
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newEmployee, setNewEmployee] = useState<{ name: string; age: string; salary: string }>({
    name: "",
    age: "",
    salary: "",
  })
  const [isAddingEmployee, setIsAddingEmployee] = useState(false)
  const [addEmployeeError, setAddEmployeeError] = useState("")

  function navigateTo(path: string) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path)
    }
    setRoute(path)
  }

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname || LOGIN_ROUTE)
    window.addEventListener("popstate", handlePopState)

    if (route === "/") {
      navigateTo(LOGIN_ROUTE)
    } else if (route !== LOGIN_ROUTE && route !== SIGNUP_ROUTE && route !== EMPLOYEES_ROUTE) {
      navigateTo(LOGIN_ROUTE)
    }

    return () => window.removeEventListener("popstate", handlePopState)
  }, [route])

  useEffect(() => {
    setIsLoading(false)
  }, [])

  async function fetchEmployees() {
    try {
      setIsFetching(true)
      const response = await fetch("/api/employees")
      const data = (await response.json()) as ApiResponse
      if (response.ok && data.employees) {
        setEmployees(data.employees.filter((employee) => employee.role !== "admin"))
      }
    } catch {
      console.error("Failed to fetch employees")
    } finally {
      setIsFetching(false)
      setIsLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = (await response.json()) as ApiResponse
      if (!response.ok) {
        throw new Error(data.message || "Login failed.")
      }

      if (data.user) {
        setCurrentUser(data.user)
        setPassword("")
        setEmail("")
        setMessage("Logged in successfully.")
        await fetchEmployees()
        navigateTo(EMPLOYEES_ROUTE)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = (await response.json()) as ApiResponse
      if (!response.ok) {
        throw new Error(data.message || "Signup failed.")
      }

      setMessage("Account created successfully. Please login.")
      setName("")
      setEmail("")
      setPassword("")
      navigateTo(LOGIN_ROUTE)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Signup failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveEdit(employeeId: string) {
    setIsSaving(true)
    setEditError("")

    try {
      const response = await fetch(`/api/profile/${employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editValues.name,
          age: editValues.age,
          salary: editValues.salary,
          currentUserId: currentUser?.id,
          currentUserRole: currentUser?.role,
        }),
      })

      const data = (await response.json()) as ApiResponse
      if (!response.ok) {
        throw new Error(data.message || "Update failed.")
      }

      setEmployees(employees.map((emp) => (emp.id === employeeId ? data.user! : emp)))
      setEditingId(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Update failed.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddEmployeeError("")
    setIsAddingEmployee(true)

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEmployee.name,
          age: newEmployee.age ? Number(newEmployee.age) : null,
          salary: newEmployee.salary ? Number(newEmployee.salary) : null,
          currentUserId: currentUser?.id,
          currentUserRole: currentUser?.role,
        }),
      })

      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.user) {
        throw new Error(data.message || "Could not add employee.")
      }

      setEmployees((prev) => [...prev, data.user as User])
      setNewEmployee({ name: "", age: "", salary: "" })
      setShowAddEmployee(false)
    } catch (error) {
      setAddEmployeeError(error instanceof Error ? error.message : "Could not add employee.")
    } finally {
      setIsAddingEmployee(false)
    }
  }

  async function handleDeleteEmployee(employeeId: string) {
  if (!window.confirm("Delete this employee?")) {
    return
  }

  setEditError("")
  setIsSaving(true)

  try {
    const response = await fetch(`/api/employees/${employeeId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentUserId: currentUser?.id,
        currentUserRole: currentUser?.role,
      }),
    })

    const data = (await response.json()) as ApiResponse
    if (!response.ok) {
      throw new Error(data.message || "Delete failed.")
    }

    setEmployees((prev) => prev.filter((employee) => employee.id !== employeeId))
    setEditingId(null)
  } catch (error) {
    setEditError(error instanceof Error ? error.message : "Delete failed.")
  } finally {
    setIsSaving(false)
  }
  }

  function handleLogout() {
    setCurrentUser(null)
    setEmployees([])
    setEmail("")
    setPassword("")
    setMessage("")
    setError("")
    setEditingId(null)
    navigateTo(LOGIN_ROUTE)
  }

  function resetAuthMessages() {
    setError("")
    setMessage("")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(180deg,#050816_0%,#0f172a_55%,#111827_100%)]">
        <LoaderCircle className="size-12 animate-spin text-cyan-400" />
      </div>
    )
  }

  if (currentUser && route === EMPLOYEES_ROUTE) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(180deg,#050816_0%,#0f172a_55%,#111827_100%)] px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">Employees</h1>
              <p className="mt-2 text-slate-400">Welcome, <span className="font-semibold text-cyan-400">{currentUser.name}</span> ({currentUser.role})</p>
            </div>
            <div className="flex items-center gap-3">
              {currentUser.role === "admin" && (
                <Button
                  onClick={() => {
                    setShowAddEmployee((prev) => !prev)
                    setAddEmployeeError("")
                  }}
                  className="h-10 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                >
                  {showAddEmployee ? "Close" : "Add Employee"}
                </Button>
              )}
              <Button onClick={handleLogout} className="h-10 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white">
                <LogOut className="mr-2 size-4" />
                Logout
              </Button>
            </div>
          </div>

          {currentUser.role === "admin" && showAddEmployee && (
            <div className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-semibold text-white">Add New Employee</h2>
              <form onSubmit={handleAddEmployee} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                  type="text"
                  placeholder="Name"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <input
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                  type="number"
                  placeholder="Age"
                  min="0"
                  value={newEmployee.age}
                  onChange={(e) => setNewEmployee((prev) => ({ ...prev, age: e.target.value }))}
                />
                <input
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                  type="number"
                  placeholder="Salary"
                  min="0"
                  value={newEmployee.salary}
                  onChange={(e) => setNewEmployee((prev) => ({ ...prev, salary: e.target.value }))}
                />
                <div className="md:col-span-2 flex items-center gap-3">
                  <Button type="submit" disabled={isAddingEmployee} className="h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950">
                    {isAddingEmployee ? (
                      <>
                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Create Employee"
                    )}
                  </Button>
                  {addEmployeeError && <span className="text-sm text-rose-300">{addEmployeeError}</span>}
                </div>
              </form>
            </div>
          )}

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-2xl shadow-black/30 backdrop-blur-xl">
            {isFetching ? (
              <div className="flex items-center justify-center p-8">
                <LoaderCircle className="mr-2 size-6 animate-spin text-cyan-400" />
                <span>Loading employees...</span>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No employees found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">Age</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">Salary</th>
                      {currentUser.role === "admin" && (
                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-white/10 hover:bg-white/5 transition">
                        <td className="px-6 py-4">
                          {editingId === emp.id && currentUser.role === "admin" ? (
                            <input
                              type="text"
                              value={editValues.name}
                              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                            />
                          ) : (
                            <span className="font-medium text-white">{emp.name}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingId === emp.id && currentUser.role === "admin" ? (
                            <input
                              type="number"
                              value={editValues.age || ""}
                              onChange={(e) => setEditValues({ ...editValues, age: e.target.value ? parseInt(e.target.value) : null })}
                              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10 w-20"
                              min="0"
                            />
                          ) : (
                            <span className="text-slate-300">{emp.age || "—"}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingId === emp.id && currentUser.role === "admin" ? (
                            <input
                              type="number"
                              value={editValues.salary || ""}
                              onChange={(e) => setEditValues({ ...editValues, salary: e.target.value ? parseInt(e.target.value) : null })}
                              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10 w-32"
                              min="0"
                            />
                          ) : (
                            <span className="text-slate-300">{emp.salary ? `$${emp.salary.toLocaleString()}` : "—"}</span>
                          )}
                        </td>
                        {currentUser.role === "admin" && (
                          <td className="px-6 py-4">
                            {editingId === emp.id ? (
                              <div className="flex gap-2">
                                <Button onClick={() => handleSaveEdit(emp.id)} disabled={isSaving} className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm"><Save className="size-4" /></Button>
                                <Button onClick={() => { setEditingId(null); setEditError("") }} disabled={isSaving} className="h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"><X className="size-4" /></Button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button onClick={() => { setEditingId(emp.id); setEditValues({ name: emp.name, age: emp.age, salary: emp.salary }); setEditError("") }} className="h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm">Edit</Button>
                                <Button onClick={() => handleDeleteEmployee(emp.id)} disabled={isSaving} className="h-8 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm">Delete</Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editError && (
              <div className="border-t border-white/10 bg-rose-500/10 px-6 py-3 text-sm text-rose-100">
                {editError}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (route === SIGNUP_ROUTE) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(180deg,#050816_0%,#0f172a_55%,#111827_100%)] px-4">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
              <LockKeyhole className="size-6" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Sign Up</h1>
            <p className="mt-2 text-sm text-slate-300">Create a new employee account.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSignup}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Name</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Email</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Password</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
              </div>
            )}

            <Button className="h-12 w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                resetAuthMessages()
                navigateTo(LOGIN_ROUTE)
              }}
              className="font-semibold text-cyan-300 hover:text-cyan-200"
            >
              Login
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(180deg,#050816_0%,#0f172a_55%,#111827_100%)] px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
            <LockKeyhole className="size-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Login</h1>
          <p className="mt-2 text-sm text-slate-300">Sign in to view and manage employees.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Password</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {message}
            </div>
          )}

          <Button className="h-12 w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Please wait
              </>
            ) : (
              "Log in"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New user?{" "}
          <button
            type="button"
            onClick={() => {
              resetAuthMessages()
              navigateTo(SIGNUP_ROUTE)
            }}
            className="font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Create account
          </button>
        </p>
      </div>
    </div>
  )
}

export default App

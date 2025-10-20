"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Users, Search, Plus, Shield, User, Heart, Pill, Settings, Mail, Phone, Lock, CheckCircle2, AlertCircle, UserPlus, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useUserManagement, type SystemUser } from "@/contexts/user-management-context"

export default function UsersPage() {
  const params = useParams()
  const role = params.role as string
  const { toast } = useToast()
  const { 
    users, 
    addUser, 
    updateUser, 
    deleteUser, 
    updateUserPermissions,
    suspendUser,
    activateUser,
    getUsersByRole,
    getActiveUsers
  } = useUserManagement()

  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false)
  const [isViewProfileOpen, setIsViewProfileOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  const [newUserData, setNewUserData] = useState({
    name: '',
    role: '',
    department: '',
    username: '',
    password: '',
    confirmPassword: '',
    status: 'active',
  })

  const [editUserData, setEditUserData] = useState({
    name: '',
    role: '',
    department: '',
    status: '',
  })

  const [userPermissions, setUserPermissions] = useState<string[]>([])

  const allPermissions = [
    { id: 'patients', label: 'Patient Management', description: 'View, create, and edit patient records' },
    { id: 'appointments', label: 'Appointments', description: 'Schedule and manage appointments' },
    { id: 'consultations', label: 'Consultations', description: 'Conduct patient consultations' },
    { id: 'billing', label: 'Billing & Invoicing', description: 'Create and manage invoices' },
    { id: 'pharmacy', label: 'Pharmacy', description: 'Dispense medication and manage prescriptions' },
    { id: 'inventory', label: 'Inventory Management', description: 'Manage stock and supplies' },
    { id: 'reports', label: 'Reports & Analytics', description: 'View and generate reports' },
    { id: 'users', label: 'User Management', description: 'Manage system users' },
    { id: 'settings', label: 'System Settings', description: 'Configure system settings' },
  ]

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.phone && user.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Remove mockUsers - using real data now
  const mockUsers_UNUSED = [
    {
      id: "U001",
      name: "Dr. Sarah Smith",
      email: "sarah.smith@sethclinic.com",
      phone: "+254 700 111 222",
      role: "clinician",
      status: "active",
      lastLogin: "2024-01-15 09:30",
      department: "General Medicine",
      permissions: ["patients", "appointments", "visits", "reports"],
    },
    {
      id: "U002",
      name: "John Receptionist",
      email: "john.reception@sethclinic.com",
      phone: "+254 700 333 444",
      role: "receptionist",
      status: "active",
      lastLogin: "2024-01-15 08:00",
      department: "Front Desk",
      permissions: ["patients", "appointments", "invoices"],
    },
    {
      id: "U003",
      name: "Mary Pharmacist",
      email: "mary.pharmacy@sethclinic.com",
      phone: "+254 700 555 666",
      role: "pharmacist",
      status: "active",
      lastLogin: "2024-01-14 16:45",
      department: "Pharmacy",
      permissions: ["pharmacy", "inventory", "reports"],
    },
    {
      id: "U004",
      name: "Admin User",
      email: "admin@sethclinic.com",
      phone: "+254 700 777 888",
      role: "admin",
      status: "active",
      lastLogin: "2024-01-15 07:30",
      department: "Administration",
      permissions: ["all"],
    },
    {
      id: "U005",
      name: "Dr. Michael Johnson",
      email: "michael.johnson@sethclinic.com",
      phone: "+254 700 999 000",
      role: "clinician",
      status: "inactive",
      lastLogin: "2024-01-10 14:20",
      department: "Cardiology",
      permissions: ["patients", "appointments", "visits", "reports"],
    },
  ]

  const roleConfig = {
    receptionist: { label: "Receptionist", icon: User, color: "bg-blue-500" },
    clinician: { label: "Clinician/Nurse", icon: Heart, color: "bg-primary" },
    pharmacist: { label: "Pharmacist", icon: Pill, color: "bg-accent" },
    admin: { label: "Administrator", icon: Shield, color: "bg-destructive" },
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "inactive":
        return "bg-gray-500"
      case "suspended":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const handleAddUser = () => {
    setIsAddUserOpen(true)
  }

  const handleEditUser = (user: SystemUser) => {
    setSelectedUser(user)
    setEditUserData({
      name: user.name,
      role: user.role,
      department: user.department || '',
      status: user.status,
    })
    setIsEditUserOpen(true)
  }

  const handlePermissions = (user: SystemUser) => {
    setSelectedUser(user)
    setUserPermissions(user.permissions || [])
    setIsPermissionsOpen(true)
  }

  const handleViewProfile = (user: SystemUser) => {
    setSelectedUser(user)
    setIsViewProfileOpen(true)
  }

  const handleReactivate = (user: SystemUser) => {
    try {
      activateUser(user.id)
      toast({
        title: "User Reactivated",
        description: `${user.name} has been reactivated successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reactivate user",
        variant: "error",
      })
    }
  }

  const handleSuspendUser = (user: SystemUser) => {
    try {
      suspendUser(user.id)
      toast({
        title: "User Suspended",
        description: `${user.name} has been suspended.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to suspend user",
        variant: "error",
      })
    }
  }

  const handleDeleteUser = (user: SystemUser) => {
    try {
      deleteUser(user.id)
      toast({
        title: "User Deleted",
        description: `${user.name} has been removed from the system.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "error",
      })
    }
  }

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Validation
    if (newUserData.password !== newUserData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "error",
      })
      setIsLoading(false)
      return
    }

    if (!newUserData.name || !newUserData.role || !newUserData.username || !newUserData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (name, role, username, password)",
        variant: "error",
      })
      setIsLoading(false)
      return
    }

    try {
      const newUser = addUser({
        name: newUserData.name,
        role: newUserData.role as SystemUser['role'],
        department: newUserData.department || undefined,
        status: 'active',
        permissions: getRoleDefaultPermissions(newUserData.role as SystemUser['role']),
        username: newUserData.username,
        password: newUserData.password,
      })
      
      toast({
        title: "User Created Successfully",
        description: `${newUser.name} has been added to the system with ID: ${newUser.id}`,
      })

      // Reset form
      setNewUserData({
        name: '',
        role: '',
        department: '',
        username: '',
        password: '',
        confirmPassword: '',
        status: 'active',
      })
      setIsAddUserOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user. Please try again.",
        variant: "error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to get default permissions based on role
  const getRoleDefaultPermissions = (role: SystemUser['role']): string[] => {
    switch (role) {
      case 'admin':
        return ['patients', 'appointments', 'consultations', 'billing', 'pharmacy', 'inventory', 'reports', 'users', 'settings']
      case 'clinician':
        return ['patients', 'consultations', 'appointments', 'reports']
      case 'nurse':
        return ['patients', 'consultations', 'appointments']
      case 'pharmacist':
        return ['pharmacy', 'inventory', 'reports']
      case 'receptionist':
        return ['patients', 'appointments', 'billing']
      default:
        return []
    }
  }

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (!selectedUser) return

    try {
      updateUser(selectedUser.id, {
        name: editUserData.name,
        role: editUserData.role as SystemUser['role'],
        department: editUserData.department || undefined,
        status: editUserData.status as SystemUser['status'],
      })
      
      toast({
        title: "User Updated Successfully",
        description: `${editUserData.name}'s information has been updated.`,
      })

      setIsEditUserOpen(false)
      setSelectedUser(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user. Please try again.",
        variant: "error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePermissionsSubmit = async () => {
    setIsLoading(true)

    if (!selectedUser) return

    try {
      updateUserPermissions(selectedUser.id, userPermissions)
      
      toast({
        title: "Permissions Updated",
        description: `Permissions for ${selectedUser.name} have been updated successfully.`,
      })

      setIsPermissionsOpen(false)
      setSelectedUser(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update permissions. Please try again.",
        variant: "error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const togglePermission = (permissionId: string) => {
    setUserPermissions(prev => 
      prev.includes(permissionId) 
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    )
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage system users and permissions</p>
          </div>
          <Button onClick={handleAddUser}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* User Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <User className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {users.filter((user: SystemUser) => user.status === "active").length}
              </div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clinicians</CardTitle>
              <Heart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter((user: SystemUser) => user.role === "clinician").length}</div>
              <p className="text-xs text-muted-foreground">Medical staff</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter((user: SystemUser) => user.role === "admin").length}</div>
              <p className="text-xs text-muted-foreground">System administrators</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Users</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
            <TabsTrigger value="roles">By Role</TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search users..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4">
              {filteredUsers.map((user) => {
                const roleInfo = roleConfig[user.role as keyof typeof roleConfig]
                const RoleIcon = roleInfo?.icon || User
                return (
                  <Card key={user.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback className={`${roleInfo?.color} text-white`}>
                              <RoleIcon className="w-5 h-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{user.name}</span>
                              <Badge variant="outline">{roleInfo?.label}</Badge>
                              <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <Mail className="w-4 h-4" />
                                <span>{user.email}</span>
                              </div>
                              {user.phone && (
                                <div className="flex items-center space-x-1">
                                  <Phone className="w-4 h-4" />
                                  <span>{user.phone}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.department} • Last login: {user.lastLogin}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                            <Settings className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePermissions(user)}>
                            Permissions
                          </Button>
                          {user.status === 'active' && (
                            <Button variant="outline" size="sm" onClick={() => handleSuspendUser(user)}>
                              Suspend
                            </Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="active">
            <div className="grid gap-4">
              {filteredUsers
                .filter((user) => user.status === "active")
                .map((user) => {
                  const roleInfo = roleConfig[user.role as keyof typeof roleConfig]
                  const RoleIcon = roleInfo?.icon || User
                  return (
                    <Card key={user.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={user.avatar} alt={user.name} />
                              <AvatarFallback className={`${roleInfo?.color} text-white`}>
                                <RoleIcon className="w-5 h-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{user.name}</span>
                                <Badge variant="outline">{roleInfo?.label}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.department} • Last active: {user.lastLogin}
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleViewProfile(user)}>
                            View Profile
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </TabsContent>

          <TabsContent value="inactive">
            <div className="grid gap-4">
              {filteredUsers
                .filter((user) => user.status === "inactive" || user.status === "suspended")
                .map((user) => {
                  const roleInfo = roleConfig[user.role as keyof typeof roleConfig]
                  const RoleIcon = roleInfo?.icon || User
                  return (
                    <Card key={user.id} className="opacity-75">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 bg-gray-400 rounded-lg flex items-center justify-center`}>
                              <RoleIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{user.name}</span>
                                <Badge variant="outline">{roleInfo?.label}</Badge>
                                <Badge className="bg-gray-500">inactive</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.department} • Last seen: {user.lastLogin}
                              </div>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => handleReactivate(user)}>Reactivate</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </TabsContent>

          <TabsContent value="roles">
            <div className="space-y-6">
              {Object.entries(roleConfig).map(([roleKey, roleInfo]) => {
                const roleUsers = filteredUsers.filter((user) => user.role === roleKey)
                const RoleIcon = roleInfo.icon
                return (
                  <Card key={roleKey}>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <div className={`w-8 h-8 ${roleInfo.color} rounded-lg flex items-center justify-center`}>
                          <RoleIcon className="w-4 h-4 text-white" />
                        </div>
                        <span>{roleInfo.label}</span>
                        <Badge variant="outline">{roleUsers.length} users</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {roleUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                              <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                                Edit
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add User Dialog */}
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New User
              </DialogTitle>
              <DialogDescription>Create a new user account for the clinic management system.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUserSubmit} className="space-y-6 py-4">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-name">Full Name *</Label>
                    <Input
                      id="add-name"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({...newUserData, name: e.target.value})}
                      placeholder="Dr. John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-username">Username *</Label>
                    <Input
                      id="add-username"
                      value={newUserData.username}
                      onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
                      placeholder="john.doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-role">Role *</Label>
                    <Select value={newUserData.role} onValueChange={(value) => setNewUserData({...newUserData, role: value})}>
                      <SelectTrigger id="add-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receptionist">Receptionist</SelectItem>
                        <SelectItem value="nurse">Nurse</SelectItem>
                        <SelectItem value="clinician">Clinician/Doctor</SelectItem>
                        <SelectItem value="pharmacist">Pharmacist</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="add-department">Department *</Label>
                    <Input
                      id="add-department"
                      value={newUserData.department}
                      onChange={(e) => setNewUserData({...newUserData, department: e.target.value})}
                      placeholder="e.g., General Medicine, Pharmacy, Administration"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Security Credentials
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-password">Password *</Label>
                    <Input
                      id="add-password"
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                      placeholder="Enter secure password"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-confirm-password">Confirm Password *</Label>
                    <Input
                      id="add-confirm-password"
                      type="password"
                      value={newUserData.confirmPassword}
                      onChange={(e) => setNewUserData({...newUserData, confirmPassword: e.target.value})}
                      placeholder="Re-enter password"
                      required
                    />
                  </div>
                </div>
                {newUserData.password && newUserData.confirmPassword && newUserData.password !== newUserData.confirmPassword && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>Passwords do not match</span>
                  </div>
                )}
              </div>

              {/* Account Status */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Account Status</h3>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="add-status">Active Status</Label>
                    <p className="text-sm text-muted-foreground">User will be able to log in immediately</p>
                  </div>
                  <Switch
                    id="add-status"
                    checked={newUserData.status === 'active'}
                    onCheckedChange={(checked) => setNewUserData({...newUserData, status: checked ? 'active' : 'inactive'})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating User...' : 'Create User'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Edit User
              </DialogTitle>
              <DialogDescription>Update user information for {selectedUser?.name}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditUserSubmit} className="space-y-6 py-4">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name *</Label>
                    <Input
                      id="edit-name"
                      value={editUserData.name}
                      onChange={(e) => setEditUserData({...editUserData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-role">Role *</Label>
                    <Select value={editUserData.role} onValueChange={(value) => setEditUserData({...editUserData, role: value})}>
                      <SelectTrigger id="edit-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receptionist">Receptionist</SelectItem>
                        <SelectItem value="nurse">Nurse</SelectItem>
                        <SelectItem value="clinician">Clinician/Doctor</SelectItem>
                        <SelectItem value="pharmacist">Pharmacist</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-department">Department *</Label>
                    <Input
                      id="edit-department"
                      value={editUserData.department}
                      onChange={(e) => setEditUserData({...editUserData, department: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Account Status */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Account Status</h3>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editUserData.status} onValueChange={(value) => setEditUserData({...editUserData, status: value})}>
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update User'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Manage Permissions
              </DialogTitle>
              <DialogDescription>Configure access permissions for {selectedUser?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* User Role Info */}
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Current Role</p>
                      <p className="text-2xl font-bold capitalize">{selectedUser?.role}</p>
                    </div>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      {userPermissions.length} permissions
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Permissions List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Access Permissions</h3>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setUserPermissions(allPermissions.map(p => p.id))}
                    >
                      Select All
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setUserPermissions([])}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {allPermissions.map((permission) => (
                    <Card key={permission.id} className={userPermissions.includes(permission.id) ? 'border-primary' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={`perm-${permission.id}`}
                              checked={userPermissions.includes(permission.id)}
                              onCheckedChange={() => togglePermission(permission.id)}
                              className="mt-1"
                            />
                            <div className="space-y-1">
                              <Label
                                htmlFor={`perm-${permission.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {permission.label}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {permission.description}
                              </p>
                            </div>
                          </div>
                          {userPermissions.includes(permission.id) && (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Role-based Recommendations */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-900">Permission Recommendations</p>
                      <p className="text-sm text-blue-700">
                        {selectedUser?.role === 'admin' && 'Administrators typically have access to all system features.'}
                        {selectedUser?.role === 'clinician' && 'Clinicians typically need: Patients, Consultations, and Reports.'}
                        {selectedUser?.role === 'pharmacist' && 'Pharmacists typically need: Pharmacy, Inventory, and Reports.'}
                        {selectedUser?.role === 'receptionist' && 'Receptionists typically need: Patients, Appointments, and Billing.'}
                        {selectedUser?.role === 'nurse' && 'Nurses typically need: Patients, Consultations, and Appointments.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPermissionsOpen(false)} 
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handlePermissionsSubmit} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Permissions'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewProfileOpen} onOpenChange={setIsViewProfileOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>User Profile</DialogTitle>
              <DialogDescription>Profile details for {selectedUser?.name}</DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p className="text-sm">{selectedUser.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Role</p>
                    <p className="text-sm">{roleConfig[selectedUser.role as keyof typeof roleConfig]?.label}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-sm">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-sm">{selectedUser.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Department</p>
                    <p className="text-sm">{selectedUser.department}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge className={getStatusColor(selectedUser.status)}>{selectedUser.status}</Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Permissions</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedUser.permissions?.map((perm: string) => (
                        <Badge key={perm} variant="outline">{perm}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

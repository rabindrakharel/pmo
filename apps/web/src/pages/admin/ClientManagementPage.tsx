import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, type Client } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  Globe,
} from 'lucide-react';

export function ClientManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const queryClient = useQueryClient();

  // Fetch clients with search
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['admin', 'clients', searchTerm],
    queryFn: () => api.getClients(searchTerm ? { search: searchTerm } : {}),
  });

  // Mutations
  const createClientMutation = useMutation({
    mutationFn: api.createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      setIsCreateDialogOpen(false);
      toast.success('Client created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create client: ' + error.message);
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      api.updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      setEditingClient(null);
      toast.success('Client updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update client: ' + error.message);
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: api.deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      toast.success('Client deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete client: ' + error.message);
    },
  });

  const clients = clientsData?.data || [];

  const handleCreateClient = (formData: FormData) => {
    const contactData: any = {};
    
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const website = formData.get('website') as string;
    
    if (email) contactData.email = email;
    if (phone) contactData.phone = phone;
    if (address) contactData.address = address;
    if (website) contactData.website = website;

    const data = {
      name: formData.get('name') as string,
      contact: contactData,
      tags: [],
      attr: {},
    };

    createClientMutation.mutate(data);
  };

  const handleUpdateClient = (formData: FormData) => {
    if (!editingClient) return;

    const contactData: any = {};
    
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const website = formData.get('website') as string;
    
    if (email) contactData.email = email;
    if (phone) contactData.phone = phone;
    if (address) contactData.address = address;
    if (website) contactData.website = website;

    const data = {
      name: formData.get('name') as string,
      contact: contactData,
    };

    updateClientMutation.mutate({
      id: editingClient.id,
      data,
    });
  };

  const handleDeleteClient = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteClientMutation.mutate(id);
    }
  };

  const getContactInfo = (contact: any) => {
    const info = [];
    if (contact?.email) info.push({ icon: Mail, value: contact.email, type: 'email' });
    if (contact?.phone) info.push({ icon: Phone, value: contact.phone, type: 'phone' });
    if (contact?.address) info.push({ icon: MapPin, value: contact.address, type: 'address' });
    if (contact?.website) info.push({ icon: Globe, value: contact.website, type: 'website' });
    return info;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Client Management</h1>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">
            Manage client information and contact details
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateClient(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  name="name"
                  placeholder="Enter client name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  name="email"
                  type="email"
                  placeholder="Enter email address (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-phone">Phone</Label>
                <Input
                  id="create-phone"
                  name="phone"
                  placeholder="Enter phone number (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-address">Address</Label>
                <Textarea
                  id="create-address"
                  name="address"
                  placeholder="Enter address (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-website">Website</Label>
                <Input
                  id="create-website"
                  name="website"
                  type="url"
                  placeholder="Enter website URL (optional)"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createClientMutation.isPending}
                >
                  {createClientMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>Clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {clients.map((client) => {
              const contactInfo = getContactInfo(client.contact);
              
              return (
                <div
                  key={client.id}
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{client.name}</span>
                    </div>
                    
                    {contactInfo.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {contactInfo.map((info, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <info.icon className="h-3 w-3" />
                            {info.type === 'email' ? (
                              <a href={`mailto:${info.value}`} className="hover:text-foreground">
                                {info.value}
                              </a>
                            ) : info.type === 'phone' ? (
                              <a href={`tel:${info.value}`} className="hover:text-foreground">
                                {info.value}
                              </a>
                            ) : info.type === 'website' ? (
                              <a 
                                href={info.value} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="hover:text-foreground truncate"
                              >
                                {info.value}
                              </a>
                            ) : (
                              <span className="truncate">{info.value}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingClient(client)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClient(client.id, client.name)}
                      disabled={deleteClientMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {clients.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No clients found matching your search.' : 'No clients created yet.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingClient && (
        <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateClient(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingClient.name}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  name="email"
                  type="email"
                  defaultValue={editingClient.contact?.email || ''}
                  placeholder="Enter email address (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  name="phone"
                  defaultValue={editingClient.contact?.phone || ''}
                  placeholder="Enter phone number (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Textarea
                  id="edit-address"
                  name="address"
                  defaultValue={editingClient.contact?.address || ''}
                  placeholder="Enter address (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-website">Website</Label>
                <Input
                  id="edit-website"
                  name="website"
                  type="url"
                  defaultValue={editingClient.contact?.website || ''}
                  placeholder="Enter website URL (optional)"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingClient(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateClientMutation.isPending}
                >
                  {updateClientMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
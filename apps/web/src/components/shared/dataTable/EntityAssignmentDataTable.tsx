import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle, X, Edit2, Search, ChevronDown, ChevronRight, Check } from 'lucide-react';

interface AssignedEntity {
  id: string;
  parent_entity_id: string;
  parent_entity: string;
  parent_entity_name: string;
  from_ts: string;
  active: boolean;
}

interface AvailableParentEntity {
  id: string;
  name: string;
  entity_type: string;
}

interface EntityAssignmentDataTableProps {
  actionEntityId: string;
  actionEntityType: string;
  actionEntityName: string;
}

export function EntityAssignmentDataTable({
  actionEntityId,
  actionEntityType,
  actionEntityName
}: EntityAssignmentDataTableProps) {
  const [assignments, setAssignments] = useState<AssignedEntity[]>([]);
  const [availableParents, setAvailableParents] = useState<AvailableParentEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showSavedMessage, setShowSavedMessage] = useState(false);

  // Removed UI RBAC logic - validation now handled by API data gating
  const effectiveCanAssign = true; // Always allow UI actions - API will validate

  const API_BASE = 'http://localhost:4000';

  // Get authentication token from existing app context
  const ensureAuthentication = async (): Promise<string> => {
    // Try to get token from localStorage first (set by main app authentication)
    let token = localStorage.getItem('authToken');

    // If no token in localStorage, try to get from sessionStorage or other sources
    if (!token) {
      token = sessionStorage.getItem('authToken');
    }

    // As last resort, attempt auto-login (for development/testing)
    if (!token) {
      console.log('EntityAssignmentDataTable: No token found, attempting auto-login...');
      try {
        const loginResponse = await fetch(`${API_BASE}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'james.miller@huronhome.ca',
            password: 'password123'
          })
        });

        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          token = loginData.token;
          localStorage.setItem('authToken', token);
          console.log('EntityAssignmentDataTable: Auto-login successful');
        } else {
          throw new Error('Auto-login failed');
        }
      } catch (loginError) {
        console.error('EntityAssignmentDataTable: Auto-login failed:', loginError);
        throw new Error('Authentication failed');
      }
    }

    return token;
  };

  // Get entity name from available parents list (avoid additional API calls)
  const getEntityNameFromCache = (entityCode: string, entityId: string): string => {
    const entity = availableParents.find(p => p.entity_type === entityCode && p.id === entityId);
    return entity?.name || 'Unknown Entity';
  };

  // Load real data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log(`EntityAssignmentDataTable: Loading data for ${actionEntityType} ${actionEntityId}`);

        const token = await ensureAuthentication();
        const authHeaders = { 'Authorization': `Bearer ${token}` };

        // Fetch current assignments from entity hierarchy mapping
        const assignmentsResponse = await fetch(
          `${API_BASE}/api/v1/entity/${actionEntityType}/${actionEntityId}/parent-assignments`,
          { headers: authHeaders }
        );

        let currentAssignments: AssignedEntity[] = [];
        if (assignmentsResponse.ok) {
          const assignmentsData = await assignmentsResponse.json();
          console.log('Current assignments response:', assignmentsData);

          if (assignmentsData.data && Array.isArray(assignmentsData.data)) {
            // Store assignments temporarily without names, we'll add names after loading available parents
            currentAssignments = assignmentsData.data.map((assignment: any) => ({
              id: assignment.id,
              parent_entity_id: assignment.parent_entity_id,
              parent_entity: assignment.parent_entity,
              parent_entity_name: '', // Will be filled after loading available parents
              from_ts: assignment.from_ts,
              active: assignment.active
            }));
          }
        } else {
          console.warn('Failed to fetch current assignments:', assignmentsResponse.status);
          if (assignmentsResponse.status === 404) {
            // No assignments found - this is normal for new entities
            console.log('No parent assignments found for this entity');
          } else {
            // Log the error but don't fail completely
            const errorText = await assignmentsResponse.text();
            console.error('Assignment fetch error:', errorText);
          }
        }

        // Fetch eligible parent entity types from meta hierarchy
        const hierarchyResponse = await fetch(
          `${API_BASE}/api/v1/meta/entity-hierarchy/eligible-parents?action_entity=${actionEntityType}`,
          { headers: authHeaders }
        );

        let eligibleParentTypes: string[] = [];
        if (hierarchyResponse.ok) {
          const hierarchyData = await hierarchyResponse.json();
          console.log('Eligible parent types response:', hierarchyData);
          eligibleParentTypes = hierarchyData.data || [];
        } else {
          console.warn('Failed to fetch eligible parent types, using defaults');
          const errorText = await hierarchyResponse.text();
          console.error('Hierarchy fetch error:', errorText);
          // Default eligible parent types for project
          eligibleParentTypes = ['biz', 'client'];
        }

        // Fetch all available entities for each eligible parent type
        const allAvailableParents: AvailableParentEntity[] = [];

        for (const parentType of eligibleParentTypes) {
          try {
            const endpoint = getEntityEndpoint(parentType);
            const entitiesResponse = await fetch(`${API_BASE}${endpoint}`, { headers: authHeaders });

            if (entitiesResponse.ok) {
              const entitiesData = await entitiesResponse.json();
              console.log(`Fetched ${parentType} entities:`, entitiesData);

              if (entitiesData.data && Array.isArray(entitiesData.data)) {
                const entities = entitiesData.data.map((entity: any) => ({
                  id: entity.id,
                  name: entity.name,
                  entity_type: parentType
                }));
                allAvailableParents.push(...entities);
              }
            } else {
              console.warn(`Failed to fetch ${parentType} entities:`, entitiesResponse.status);
            }
          } catch (error) {
            console.error(`Error fetching ${parentType} entities:`, error);
          }
        }

        // Now that we have available parents, populate assignment names
        const assignmentsWithNames = currentAssignments.map(assignment => ({
          ...assignment,
          parent_entity_name: allAvailableParents.find(p =>
            p.entity_type === assignment.parent_entity && p.id === assignment.parent_entity_id
          )?.name || 'Unknown Entity'
        }));

        console.log('EntityAssignmentDataTable: Loaded assignments:', assignmentsWithNames);
        console.log('EntityAssignmentDataTable: Available parents:', allAvailableParents);

        setAssignments(assignmentsWithNames);
        setAvailableParents(allAvailableParents);
        setLoading(false);
      } catch (error) {
        console.error('EntityAssignmentDataTable: Error loading data:', error);
        setError('Failed to load parent entity assignments');
        setLoading(false);
      }
    };

    loadData();
  }, [actionEntityId, actionEntityType]);

  // Close search input when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.search-container') &&
          !target.closest('.add-button') &&
          !target.closest('.search-dropdown')) {
        setShowSearchInput(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to get API endpoint for entity type
  const getEntityEndpoint = (entityCode: string): string => {
    const endpoints: Record<string, string> = {
      'biz': '/api/v1/biz',
      'org': '/api/v1/entity/org',
      'client': '/api/v1/client',
      'project': '/api/v1/project',
      'hr': '/api/v1/hr',
      'worksite': '/api/v1/worksite',
      'employee': '/api/v1/employee',
      'role': '/api/v1/role'
    };
    return endpoints[entityCode] || `/api/v1/entity/${entityCode}`;
  };

  // Helper function to get entity type display name
  const getEntityTypeDisplayName = (entityCode: string): string => {
    const displayNames: Record<string, string> = {
      'biz': 'Business',
      'org': 'Organization',
      'client': 'Client',
      'project': 'Project',
      'hr': 'HR',
      'worksite': 'Worksite'
    };
    return displayNames[entityCode] || entityCode.charAt(0).toUpperCase() + entityCode.slice(1);
  };

  // Helper function to get entity type color
  const getEntityTypeColor = (entityCode: string): string => {
    const colors: Record<string, string> = {
      'biz': 'bg-dark-1000',
      'org': 'bg-green-500',
      'client': 'bg-slate-500',
      'project': 'bg-orange-500',
      'hr': 'bg-pink-500',
      'worksite': 'bg-slate-600'
    };
    return colors[entityCode] || 'bg-dark-1000';
  };

  // Filter available parents by search term
  const getFilteredAvailableParents = () => {
    if (!searchTerm) return availableParents;
    return availableParents.filter(parent =>
      parent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parent.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get all available parents (assigned and unassigned for checkbox interface)
  const getAllAvailableParents = () => {
    return getFilteredAvailableParents();
  };

  // Check if entity is assigned
  const isEntityAssigned = (entityId: string) => {
    return assignments.some(a => a.parent_entity_id === entityId);
  };

  // Group available parents by entity type
  const getGroupedAvailableParents = () => {
    const filtered = getFilteredAvailableParents();
    const grouped = filtered.reduce((groups, parent) => {
      const entityCode = parent.entity_type;
      if (!groups[entityCode]) {
        groups[entityCode] = [];
      }
      groups[entityCode].push(parent);
      return groups;
    }, {} as Record<string, AvailableParentEntity[]>);

    return grouped;
  };

  // Group current assignments by entity type
  const getGroupedAssignments = () => {
    const grouped = assignments.reduce((groups, assignment) => {
      const entityCode = assignment.parent_entity;
      if (!groups[entityCode]) {
        groups[entityCode] = [];
      }
      groups[entityCode].push(assignment);
      return groups;
    }, {} as Record<string, AssignedEntity[]>);

    return grouped;
  };

  const handleAddAssignment = async (entityCode: string, entityId: string, entityName: string, closeSearchOnSuccess: boolean = true) => {
    if (!effectiveCanAssign) return;

    try {
      const token = await ensureAuthentication();
      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const newAssignmentData = {
        action_entity_id: actionEntityId,
        action_entity: actionEntityType,
        parent_entity_id: entityId,
        parent_entity: entityCode
      };

      const response = await fetch(
        `${API_BASE}/api/v1/entity/${actionEntityType}/${actionEntityId}/parent-assignments`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(newAssignmentData)
        }
      );

      if (response.ok) {
        const responseData = await response.json();
        const newAssignment: AssignedEntity = {
          id: responseData.data?.id || `temp-${Date.now()}`,
          parent_entity_id: entityId,
          parent_entity: entityCode,
          parent_entity_name: entityName,
          from_ts: new Date().toISOString(),
          active: true
        };
        setAssignments(prev => [...prev, newAssignment]);
        setSuccessMessage(`Added ${getEntityTypeDisplayName(entityCode)}: ${entityName}`);
        setTimeout(() => setSuccessMessage(null), 3000);

        if (closeSearchOnSuccess) {
          setShowSearchInput(false);
          setSearchTerm('');
        }
      } else {
        const errorData = await response.text();
        console.error('Failed to add assignment:', response.status, errorData);
        setError(`Failed to add parent entity assignment: ${response.status}`);
      }
    } catch (error) {
      console.error('Error adding assignment:', error);
      setError('Failed to add parent entity assignment');
    }
  };

  const handleRemoveAssignment = async (assignment: AssignedEntity) => {
    if (!effectiveCanAssign) return;

    try {
      const token = await ensureAuthentication();
      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await fetch(
        `${API_BASE}/api/v1/entity/${actionEntityType}/${actionEntityId}/parent-assignments/${assignment.id}`,
        {
          method: 'DELETE',
          headers: authHeaders
        }
      );

      if (response.ok) {
        setAssignments(prev => prev.filter(a => a.id !== assignment.id));
        setSuccessMessage(`Removed ${getEntityTypeDisplayName(assignment.parent_entity)}: ${assignment.parent_entity_name}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const errorData = await response.text();
        console.error('Failed to remove assignment:', response.status, errorData);
        setError(`Failed to remove parent entity assignment: ${response.status}`);
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      setError('Failed to remove parent entity assignment');
    }
  };

  const handleToggleCheckbox = async (parent: AvailableParentEntity) => {
    if (!effectiveCanAssign) return;

    const isCurrentlyAssigned = isEntityAssigned(parent.id);

    if (isCurrentlyAssigned) {
      // Find and remove the assignment
      const assignment = assignments.find(a => a.parent_entity_id === parent.id);
      if (assignment) {
        await handleRemoveAssignment(assignment);
      }
    } else {
      // Add the assignment - don't close search to allow multiple selections
      await handleAddAssignment(parent.entity_type, parent.id, parent.name, false);
    }
  };

  const toggleGroupCollapse = (entityCode: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [entityCode]: !prev[entityCode]
    }));
  };

  const handleSaveChanges = () => {
    setIsEditMode(false);
    setShowSearchInput(false);
    setSearchTerm('');
    setShowSavedMessage(true);

    // Auto-hide the "Saved" message after 2 seconds
    setTimeout(() => {
      setShowSavedMessage(false);
    }, 2000);
  };


  if (loading) {
    return (
      <div className="bg-white shadow rounded-md p-6">
        <h3 className="text-sm font-normal text-dark-600 mb-4">Parent Entity Assignments</h3>
        <div className="flex items-center text-dark-700">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-dark-700 mr-2"></div>
          Loading parent entity assignments...
        </div>
      </div>
    );
  }


  return (
    <div className="bg-white shadow rounded-md p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-normal text-dark-600">Parent Entity Assignments</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-700">
            {actionEntityType}: {actionEntityName}
          </span>
          {effectiveCanAssign && (
            <button
              onClick={isEditMode ? handleSaveChanges : () => setIsEditMode(true)}
              className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all ${
                showSavedMessage
                  ? 'border-green-300 text-green-700 bg-green-50 focus:ring-green-500/50'
                  : isEditMode
                    ? 'border-slate-600 text-white bg-slate-600 hover:bg-slate-700 focus:ring-slate-500/50 shadow-sm'
                    : 'border-dark-300 text-dark-700 bg-white hover:border-dark-400 focus:ring-slate-500/30'
              }`}
            >
              {showSavedMessage ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : isEditMode ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Edit2 className="h-3 w-3 mr-1" />
              )}
              {showSavedMessage ? 'Saved' : isEditMode ? 'Save' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-green-800">
              <CheckCircle className="h-4 w-4 mr-2" />
              {successMessage}
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-600 hover:text-green-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-red-800">
              <AlertCircle className="h-4 w-4 mr-2" />
              {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Assignments Container */}
      <div className="space-y-3 min-h-[300px] relative">
        {/* Grouped Assignment Display */}
        {Object.keys(getGroupedAssignments()).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(getGroupedAssignments()).map(([entityCode, entityAssignments]) => (
              <div key={entityCode} className="bg-dark-100 rounded p-3 border border-dark-300">
                {/* Entity Type Header */}
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-normal text-dark-600 flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-dark-1000 rounded-full"></div>
                    {getEntityTypeDisplayName(entityCode)}
                    <span className="text-xs text-dark-600 font-normal">
                      ({entityAssignments.length} assigned)
                    </span>
                  </h4>
                </div>

                {/* Entity Items */}
                <div className="flex flex-wrap gap-1.5">
                  {entityAssignments.map(assignment => (
                    <div
                      key={assignment.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 bg-dark-100 text-dark-600 text-xs rounded border border-dark-300 shadow-sm"
                    >
                      <span>{assignment.parent_entity_name}</span>
                      {isEditMode && effectiveCanAssign && (
                        <button
                          onClick={() => handleRemoveAssignment(assignment)}
                          className="ml-0.5 p-0.5 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-full transition-colors"
                          title="Remove assignment"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-dark-700">
            <p className="text-xs">No parent entity assignments yet.</p>
            {effectiveCanAssign && (
              <p className="text-xs mt-1 text-dark-600">Click "Add Parent Entity" to assign parent entities.</p>
            )}
          </div>
        )}

        {/* Add New Assignment Section */}
        <div className="border-t border-dark-300 pt-4">
          {/* Add New Assignment Button/Search */}
          {effectiveCanAssign && (
            <div className="relative">
              {!showSearchInput ? (
                <button
                  onClick={() => setShowSearchInput(true)}
                  className="add-button inline-flex items-center gap-1 px-2.5 py-1 border border-dashed border-dark-400 text-dark-700 text-xs rounded hover:border-dark-400 hover:text-dark-700 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add Parent Entity
                </button>
              ) : (
                <div className="search-container flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-dark-600" />
                    <input
                      type="text"
                      placeholder="Search to add parent entity..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 border border-dark-400 rounded focus:ring-1 focus:ring-dark-7000 focus:border-dark-3000 text-xs min-w-56"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => {
                      setShowSearchInput(false);
                      setSearchTerm('');
                    }}
                    className="p-1 text-dark-600 hover:text-dark-700 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Search Results Dropdown */}
              {showSearchInput && (
                <div className="search-dropdown absolute top-full left-0 mt-1 w-80 bg-dark-100 border border-dark-300 rounded shadow-sm z-50 max-h-64 overflow-y-auto" style={{ maxHeight: '256px' }}>
                  {Object.keys(getGroupedAvailableParents()).length === 0 ? (
                    <div className="p-3 text-center text-dark-700 text-xs">
                      {searchTerm ? 'No matching entities found' : 'No entities available'}
                    </div>
                  ) : (
                    <div className="p-1">
                      {Object.entries(getGroupedAvailableParents()).map(([entityCode, parents]) => {
                        const isCollapsed = collapsedGroups[entityCode];
                        const assignedCount = parents.filter(parent => isEntityAssigned(parent.id)).length;

                        return (
                          <div key={entityCode} className="mb-2 last:mb-0">
                            {/* Entity Type Header - Clickable */}
                            <div
                              className="sticky top-0 bg-dark-100 px-2 py-1.5 border-b border-dark-300 mb-1.5 cursor-pointer hover:bg-dark-100 transition-colors rounded"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleGroupCollapse(entityCode);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                  {isCollapsed ? (
                                    <ChevronRight className="h-2.5 w-2.5 text-dark-700" />
                                  ) : (
                                    <ChevronDown className="h-2.5 w-2.5 text-dark-700" />
                                  )}
                                  <h4 className="text-xs font-normal text-dark-600 uppercase tracking-wide">
                                    {getEntityTypeDisplayName(entityCode)}
                                  </h4>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                  {assignedCount > 0 && (
                                    <span className="bg-dark-100 text-dark-600 text-xs font-normal px-1.5 py-0.5 rounded">
                                      {assignedCount}
                                    </span>
                                  )}
                                  <span className="text-xs text-dark-700">
                                    {parents.length}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Checkbox Items - Collapsible */}
                            {!isCollapsed && (
                              <div className="space-y-0.5 transition-all duration-200">
                                {parents.map(parent => {
                                  const isChecked = isEntityAssigned(parent.id);
                                  return (
                                    <div
                                      key={parent.id}
                                      className="flex items-center p-1.5 hover:bg-dark-100 rounded transition-colors cursor-pointer ml-1.5"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleToggleCheckbox(parent);
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // Handled by parent onClick
                                        className="h-3 w-3 text-dark-700 focus:ring-dark-7000 border-dark-400 rounded flex-shrink-0 pointer-events-none"
                                      />
                                      <div className="ml-2 flex-1 min-w-0">
                                        <div className="text-xs text-dark-600 truncate">
                                          {parent.name}
                                        </div>
                                      </div>
                                      {isChecked && (
                                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assignment Count */}
        <div className="pt-3 border-t border-dark-300">
          <div className="flex items-center justify-between text-xs text-dark-700">
            <span>
              {assignments.filter(a => a.active).length} parent entities assigned
            </span>
            {effectiveCanAssign && !isEditMode && (
              <span className="text-xs text-dark-600">
                Click "Edit" to manage assignments
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Search,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Loader2,
  Users,
  AlertCircle,
} from "lucide-react";
import { HIERARCHY_RANKS, isEligibleSupervisor } from "@/lib/hierarchy";
import { assignSupervisorAction, unassignSupervisorAction } from "@/lib/actions/karyawan";

export interface KaryawanForHierarchy {
  id: string;
  name: string;
  level: string | null;
  department: string | null;
  lokasiKerja: string | null;
  atasanId: string | null;
  atasanName: string | null;
  subCompanyId?: string | null;
  subCompanyName: string | null;
}

interface HierarchyTabProps {
  initialKaryawan: KaryawanForHierarchy[];
}

interface TreeNode {
  employee: KaryawanForHierarchy;
  children: TreeNode[];
}

export function HierarchyTab({ initialKaryawan }: HierarchyTabProps) {
  const [employees, setEmployees] = useState<KaryawanForHierarchy[]>(initialKaryawan);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [checkedEmployeeIds, setCheckedEmployeeIds] = useState<Set<string>>(new Set());
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Org tree expansion state
  const [isTreeSectionExpanded, setIsTreeSectionExpanded] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Notification state
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Helper to count subordinates (direct & indirect)
  const subordinatesCountMap = useMemo(() => {
    const map = new Map<string, number>();
    
    // Initialize
    employees.forEach((emp) => map.set(emp.id, 0));

    // Helper to add count to all ancestors
    const addCountToAncestors = (empId: string, visited: Set<string>) => {
      const emp = employees.find((e) => e.id === empId);
      if (!emp || !emp.atasanId || visited.has(emp.atasanId)) return;
      
      visited.add(emp.atasanId);
      const currentCount = map.get(emp.atasanId) || 0;
      map.set(emp.atasanId, currentCount + 1);
      
      addCountToAncestors(emp.atasanId, visited);
    };

    employees.forEach((emp) => {
      addCountToAncestors(emp.id, new Set());
    });

    return map;
  }, [employees]);

  // List of possible supervisors: anyone whose level is mapped in HIERARCHY_RANKS
  const supervisors = useMemo(() => {
    // Filter out level values that don't exist in HIERARCHY_RANKS
    const eligibleSups = employees.filter(
      (emp) => emp.level && HIERARCHY_RANKS[emp.level] !== undefined
    );

    // Group by level
    const groups: Record<string, KaryawanForHierarchy[]> = {};
    eligibleSups.forEach((emp) => {
      const lvl = emp.level!;
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(emp);
    });

    // Apply search filter and sort
    const query = supervisorSearch.trim().toLowerCase();
    const result: { level: string; rank: number; users: KaryawanForHierarchy[] }[] = [];

    Object.entries(groups).forEach(([level, users]) => {
      const matchedUsers = users.filter((u) => u.name.toLowerCase().includes(query));
      if (matchedUsers.length > 0) {
        // Sort users alphabetically
        matchedUsers.sort((a, b) => a.name.localeCompare(b.name));
        result.push({
          level,
          rank: HIERARCHY_RANKS[level] || 0,
          users: matchedUsers,
        });
      }
    });

    // Sort groups by rank descending (e.g. GM first, down to Foreman)
    result.sort((a, b) => b.rank - a.rank);
    return result;
  }, [employees, supervisorSearch]);

  const selectedSupervisor = useMemo(() => {
    return employees.find((e) => e.id === selectedSupervisorId) || null;
  }, [employees, selectedSupervisorId]);

  // Eligible employees for selected supervisor (only direct level below)
  const eligibleEmployees = useMemo(() => {
    if (!selectedSupervisor || !selectedSupervisor.level) return [];

    const supervisorRank = HIERARCHY_RANKS[selectedSupervisor.level] || 0;

    return employees.filter((emp) => {
      if (emp.id === selectedSupervisor.id) return false;
      if (!emp.level) return false;
      
      const empRank = HIERARCHY_RANKS[emp.level] || 0;
      return supervisorRank - empRank === 1;
    });
  }, [employees, selectedSupervisor]);

  // Filtered list of eligible employees (by search and unassigned filter)
  const filteredEligibleEmployees = useMemo(() => {
    let result = eligibleEmployees;

    const query = employeeSearch.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (emp) =>
          emp.name.toLowerCase().includes(query) ||
          (emp.department && emp.department.toLowerCase().includes(query)) ||
          (emp.subCompanyName && emp.subCompanyName.toLowerCase().includes(query))
      );
    }

    if (showUnassignedOnly) {
      result = result.filter((emp) => !emp.atasanId);
    }

    return result;
  }, [eligibleEmployees, employeeSearch, showUnassignedOnly]);

  // Build hierarchical Org Tree structure
  const orgTree = useMemo(() => {
    const map = new Map<string, TreeNode>();
    employees.forEach((emp) => {
      map.set(emp.id, { employee: emp, children: [] });
    });

    const roots: TreeNode[] = [];
    employees.forEach((emp) => {
      const node = map.get(emp.id)!;
      if (emp.atasanId && map.has(emp.atasanId)) {
        const parent = map.get(emp.atasanId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children alphabetically
    map.forEach((node) => {
      node.children.sort((a, b) => a.employee.name.localeCompare(b.employee.name));
    });

    // Sort roots alphabetically
    roots.sort((a, b) => a.employee.name.localeCompare(b.employee.name));

    return roots;
  }, [employees]);

  // Summary stats
  const stats = useMemo(() => {
    const total = employees.length;
    const unassigned = employees.filter((e) => !e.atasanId).length;
    const assigned = total - unassigned;
    return { total, unassigned, assigned };
  }, [employees]);

  // Level badge helper
  const getLevelBadgeClass = (level: string | null) => {
    if (!level) return "level-pill non-staff";
    if (level.toLowerCase().startsWith("staff")) {
      return "level-pill staff";
    }
    return "level-pill non-staff";
  };

  // Expand / collapse all node handler
  const handleToggleAllNodes = (expand: boolean) => {
    if (expand) {
      const allParentIds = new Set<string>();
      orgTree.forEach(function addNodes(node) {
        if (node.children.length > 0) {
          allParentIds.add(node.employee.id);
          node.children.forEach(addNodes);
        }
      });
      setExpandedNodes(allParentIds);
    } else {
      setExpandedNodes(new Set());
    }
  };

  const handleToggleNode = (id: string) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedNodes(next);
  };

  // Supervisor Selection change
  const handleSelectSupervisor = (id: string) => {
    setSelectedSupervisorId(id);
    setCheckedEmployeeIds(new Set()); // Reset selected employees
    setNotification(null);
  };

  // Toggle single employee checkbox
  const handleToggleEmployeeCheckbox = (id: string) => {
    const next = new Set(checkedEmployeeIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setCheckedEmployeeIds(next);
  };

  // Toggle all visible eligible employee checkboxes
  const handleToggleAllVisibleEmployees = () => {
    const allChecked = filteredEligibleEmployees.every((emp) =>
      checkedEmployeeIds.has(emp.id)
    );

    const next = new Set(checkedEmployeeIds);
    if (allChecked) {
      filteredEligibleEmployees.forEach((emp) => next.delete(emp.id));
    } else {
      filteredEligibleEmployees.forEach((emp) => next.add(emp.id));
    }
    setCheckedEmployeeIds(next);
  };

  // Assign checked employees to the selected supervisor
  const handleAssignSupervisor = () => {
    if (!selectedSupervisorId || checkedEmployeeIds.size === 0) return;

    startTransition(async () => {
      setNotification(null);
      const res = await assignSupervisorAction(
        Array.from(checkedEmployeeIds),
        selectedSupervisorId
      );

      if (res.error) {
        setNotification({ type: "error", message: res.error });
        return;
      }

      if (res.success) {
        // Update local state
        const supervisorName = selectedSupervisor?.name || "";
        setEmployees((prev) =>
          prev.map((emp) => {
            if (checkedEmployeeIds.has(emp.id) && res.successIds?.includes(emp.id)) {
              return {
                ...emp,
                atasanId: selectedSupervisorId,
                atasanName: supervisorName,
              };
            }
            return emp;
          })
        );

        const successCount = res.successIds?.length || 0;
        const failedCount = res.failedIds?.length || 0;

        if (failedCount > 0) {
          setNotification({
            type: "error",
            message: `Berhasil menetapkan ${successCount} karyawan. Gagal menetapkan ${failedCount} karyawan karena validasi level.`,
          });
        } else {
          setNotification({
            type: "success",
            message: `Berhasil menetapkan ${successCount} karyawan ke atasan ${supervisorName}.`,
          });
        }

        setCheckedEmployeeIds(new Set());
      }
    });
  };

  // Remove supervisor from an employee
  const handleUnassignSupervisor = (empId: string, name: string) => {
    if (confirm(`Hapus atasan dari ${name}?`)) {
      startTransition(async () => {
        setNotification(null);
        const res = await unassignSupervisorAction(empId);

        if (res.error) {
          setNotification({ type: "error", message: res.error });
          return;
        }

        if (res.success) {
          setEmployees((prev) =>
            prev.map((emp) => {
              if (emp.id === empId) {
                return {
                  ...emp,
                  atasanId: null,
                  atasanName: null,
                };
              }
              return emp;
            })
          );
          setNotification({
            type: "success",
            message: `Berhasil menghapus atasan dari ${name}.`,
          });
        }
      });
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.employee.id);
    const subCount = subordinatesCountMap.get(node.employee.id) || 0;

    return (
      <li key={node.employee.id} className="hierarchy-tree-item">
        <div className="hierarchy-tree-node-row">
          <div className="hierarchy-tree-node-info">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => handleToggleNode(node.employee.id)}
                className="hierarchy-tree-expand-btn"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}

            <span className="hierarchy-tree-node-avatar">
              {node.employee.name.charAt(0).toUpperCase()}
            </span>

            <div className="hierarchy-tree-node-details">
              <span className="hierarchy-tree-node-name">{node.employee.name}</span>
              <div className="hierarchy-tree-node-meta">
                <span className={getLevelBadgeClass(node.employee.level)}>
                  {node.employee.level || "Level Kosong"}
                </span>
                {node.employee.department && (
                  <span className="text-muted ml-2">{node.employee.department}</span>
                )}
                {node.employee.subCompanyName && (
                  <span className="text-muted border-l pl-2 ml-2">
                    {node.employee.subCompanyName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="hierarchy-tree-node-actions">
            {subCount > 0 && (
              <span className="sub-count-badge">
                <Users className="w-3.5 h-3.5 mr-1" />
                {subCount} Bawahan
              </span>
            )}
            {node.employee.atasanId && (
              <button
                type="button"
                className="unassign-icon-btn"
                title={`Hapus atasan (${node.employee.atasanName})`}
                onClick={() =>
                  handleUnassignSupervisor(node.employee.id, node.employee.name)
                }
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <ul className="hierarchy-tree-children">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="hierarchy-container">
      {/* Header & Stats */}
      <div className="hierarchy-overview-card">
        <div className="hierarchy-stats">
          <div className="stat-box">
            <span className="stat-val">{stats.total}</span>
            <span className="stat-label">Total Karyawan</span>
          </div>
          <div className="stat-box warning">
            <span className="stat-val">{stats.unassigned}</span>
            <span className="stat-label">Belum Diassign Atasan</span>
          </div>
          <div className="stat-box success">
            <span className="stat-val">{stats.assigned}</span>
            <span className="stat-label">Sudah Diassign Atasan</span>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {notification && (
        <div
          className={`hierarchy-alert ${
            notification.type === "success" ? "success" : "error"
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{notification.message}</span>
          <button
            type="button"
            className="alert-close-btn"
            onClick={() => setNotification(null)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Dual Columns Panel */}
      <div className="hierarchy-columns">
        {/* Left Column: Supervisor Picker */}
        <div className="hierarchy-left-col">
          <div className="col-header">
            <h3>Pilih Supervisor / Atasan</h3>
            <div className="search-wrapper">
              <Search className="search-icon w-4 h-4" />
              <input
                type="text"
                placeholder="Cari atasan..."
                value={supervisorSearch}
                onChange={(e) => setSupervisorSearch(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="col-body scrollable">
            {supervisors.length === 0 ? (
              <div className="empty-state">Tidak ada level / atasan yang cocok.</div>
            ) : (
              supervisors.map((group) => (
                <div key={group.level} className="supervisor-group">
                  <div className="group-label">
                    <span className={getLevelBadgeClass(group.level)}>{group.level}</span>
                  </div>
                  <div className="group-cards">
                    {group.users.map((sup) => {
                      const isSelected = selectedSupervisorId === sup.id;
                      const subCount = subordinatesCountMap.get(sup.id) || 0;
                      return (
                        <div
                          key={sup.id}
                          onClick={() => handleSelectSupervisor(sup.id)}
                          className={`hierarchy-supervisor-card ${isSelected ? "selected" : ""}`}
                        >
                          <div className="card-avatar">
                            {sup.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="card-info">
                            <span className="card-name">{sup.name}</span>
                            <span className="card-sub">{sup.department || "No Department"}</span>
                          </div>
                          {subCount > 0 && (
                            <span className="sub-badge">
                              {subCount} Bawahan
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Eligible Employee List */}
        <div className="hierarchy-right-col">
          {!selectedSupervisor ? (
            <div className="empty-state-prompt">
              <GitBranch className="w-12 h-12 text-gray-300 mb-4" />
              <p>Pilih salah satu supervisor di sebelah kiri untuk mengatur bawahan.</p>
            </div>
          ) : (
            <>
              <div className="col-header">
                <div className="col-title-area">
                  <h3>Bawahan untuk: {selectedSupervisor.name}</h3>
                  <span className={getLevelBadgeClass(selectedSupervisor.level)}>
                    {selectedSupervisor.level}
                  </span>
                </div>

                <div className="filter-row">
                  <div className="search-wrapper">
                    <Search className="search-icon w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Cari bawahan (nama, dept, unit)..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="search-input"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUnassignedOnly(!showUnassignedOnly)}
                    className={`toggle-chip ${showUnassignedOnly ? "active" : ""}`}
                  >
                    Belum diassign atasan
                  </button>
                </div>
              </div>

              <div className="col-body scrollable" style={{ paddingBottom: "100px" }}>
                {filteredEligibleEmployees.length === 0 ? (
                  <div className="empty-state">
                    Tidak ada karyawan yang memenuhi kriteria level bawahan.
                  </div>
                ) : (
                  <>
                    <div className="select-all-row" onClick={handleToggleAllVisibleEmployees}>
                      <input
                        type="checkbox"
                        checked={
                          filteredEligibleEmployees.length > 0 &&
                          filteredEligibleEmployees.every((emp) => checkedEmployeeIds.has(emp.id))
                        }
                        onChange={() => {}} // Controlled by row click
                        className="custom-checkbox"
                      />
                      <span>Pilih Semua yang Terlihat ({filteredEligibleEmployees.length})</span>
                    </div>

                    <div className="employee-cards-grid">
                      {filteredEligibleEmployees.map((emp) => {
                        const isChecked = checkedEmployeeIds.has(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => handleToggleEmployeeCheckbox(emp.id)}
                            className={`hierarchy-employee-card ${isChecked ? "checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Controlled by row click
                              className="custom-checkbox"
                            />
                            <div className="employee-card-info">
                              <span className="employee-name">{emp.name}</span>
                              <div className="employee-meta">
                                <span className={getLevelBadgeClass(emp.level)}>
                                  {emp.level || "Level Kosong"}
                                </span>
                                {emp.department && (
                                  <span className="meta-text">{emp.department}</span>
                                )}
                                {emp.subCompanyName && (
                                  <span className="meta-text border-l pl-2">
                                    {emp.subCompanyName}
                                  </span>
                                )}
                              </div>
                              {emp.atasanId && (
                                <div className="current-atasan">
                                  <span>Atasan Saat Ini:</span>
                                  <span className="atasan-badge">
                                    {emp.atasanName}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnassignSupervisor(emp.id, emp.name);
                                      }}
                                      className="unassign-btn"
                                      title="Hapus atasan"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Sticky Assign Footer */}
              <div className="hierarchy-assign-footer">
                <div className="footer-info">
                  <span className="footer-count">
                    {checkedEmployeeIds.size} Karyawan dipilih
                  </span>
                  {checkedEmployeeIds.size > 0 && (
                    <span className="footer-target">
                      untuk diassign ke <strong>{selectedSupervisor.name}</strong>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={checkedEmployeeIds.size === 0 || isPending}
                  onClick={handleAssignSupervisor}
                  className="btn btn-primary"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Simpan Perubahan"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Org Tree Preview Section */}
      <div className="hierarchy-tree-section">
        <div
          className="tree-section-header"
          onClick={() => setIsTreeSectionExpanded(!isTreeSectionExpanded)}
        >
          <div className="tree-header-title">
            <GitBranch className="w-5 h-5 text-primary" />
            <h3>Pratinjau Struktur Organisasi</h3>
          </div>
          <div className="tree-header-actions" onClick={(e) => e.stopPropagation()}>
            {isTreeSectionExpanded && (
              <>
                <button
                  type="button"
                  onClick={() => handleToggleAllNodes(true)}
                  className="tree-action-btn"
                >
                  Expand Semua
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllNodes(false)}
                  className="tree-action-btn"
                >
                  Collapse Semua
                </button>
              </>
            )}
            <button type="button" className="tree-toggle-btn">
              {isTreeSectionExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {isTreeSectionExpanded && (
          <div className="tree-section-body">
            {orgTree.length === 0 ? (
              <div className="empty-state">Data karyawan kosong.</div>
            ) : (
              <ul className="hierarchy-tree-root">
                {orgTree.map((rootNode) => renderTreeNode(rootNode))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

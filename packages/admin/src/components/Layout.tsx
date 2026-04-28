/**
 * Main layout component with navigation
 */

import React, { useState } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Layout as AntLayout, Menu, Dropdown, Avatar, Button, theme } from "antd";
import {
  DashboardOutlined,
  LineChartOutlined,
  MessageOutlined,
  DownloadOutlined,
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useAuth } from "../hooks/useAuth";

const { Header, Sider, Content } = AntLayout;

const menuItems = [
  {
    key: "/",
    icon: <DashboardOutlined />,
    label: "仪表盘",
  },
  {
    key: "/conversations",
    icon: <MessageOutlined />,
    label: "对话分析",
  },
  {
    key: "/performance",
    icon: <LineChartOutlined />,
    label: "性能分析",
  },
  {
    key: "/installs",
    icon: <DownloadOutlined />,
    label: "安装统计",
  },
  {
    key: "/crash-stats",
    icon: <LineChartOutlined />,
    label: "Crash 统计",
  },
  {
    key: "/alerts",
    icon: <BellOutlined />,
    label: "告警配置",
  },
  {
    key: "/users",
    icon: <UserOutlined />,
    label: "用户管理",
  },
  {
    key: "/system",
    icon: <SettingOutlined />,
    label: "系统设置",
  },
  // Hidden menu items (保留代码，暂不显示)
  // {
  //   key: "/crash-issues",
  //   icon: <BugOutlined />,
  //   label: "Crash Issues",
  // },
];

// Filter menu based on user role
function getFilteredMenuItems(role: string) {
  if (role === "viewer") {
    // Viewer can only see dashboard and analytics
    return menuItems.filter(
      (item) =>
        item.key === "/" ||
        item.key === "/conversations" ||
        item.key === "/performance" ||
        item.key === "/installs" ||
        item.key === "/crash-stats"
    );
  }
  if (role === "operator") {
    // Operator can see dashboard, analytics, alerts, crash
    return menuItems.filter(
      (item) =>
        item.key !== "/users" &&
        item.key !== "/system"
    );
  }
  // Admin sees all
  return menuItems;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { token: { colorBgContainer } } = theme.useToken();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const filteredMenuItems = getFilteredMenuItems(user.role);

  const userMenu = (
    <Menu>
      <Menu.Item key="profile">
        <span>{user.display_name || user.username}</span>
      </Menu.Item>
      <Menu.Item key="role">
        <span>角色: {user.role}</span>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" onClick={logout}>
        <LogoutOutlined /> 退出登录
      </Menu.Item>
    </Menu>
  );

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        style={{
          overflow: "auto",
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 32,
            margin: 16,
            color: "#fff",
            fontSize: collapsed ? 16 : 18,
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          {collapsed ? "QMS" : "Sudoclaw QMS"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={filteredMenuItems}
          onClick={({ key }) => {
            navigate(key);
          }}
        />
      </Sider>
      <AntLayout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header
          style={{
            padding: "0 24px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 1,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />
          <Dropdown overlay={userMenu} placement="bottomRight">
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#1890ff" }} />
              <span>{user.display_name || user.username}</span>
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            background: colorBgContainer,
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
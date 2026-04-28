/**
 * User management page (Admin only)
 */

import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  message,
  Popconfirm,
  Spin,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from "@ant-design/icons";
import { api } from "../api";
import type { User, UserRole } from "../api/types";

const roles: UserRole[] = ["admin", "operator", "viewer"];
const roleColors: Record<UserRole, string> = {
  admin: "red",
  operator: "blue",
  viewer: "green",
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await api.getUsers();
      setUsers(result);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      enabled: user.enabled,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteUser(id);
      message.success("删除成功");
      fetchUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleSubmit = async (values: {
    username?: string;
    password?: string;
    email?: string;
    display_name?: string;
    role?: UserRole;
    enabled?: boolean;
  }) => {
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, values);
        message.success("更新成功");
      } else {
        if (!values.username || !values.password) {
          message.error("请填写用户名和密码");
          return;
        }
        await api.createUser({
          username: values.username,
          password: values.password,
          email: values.email,
          display_name: values.display_name,
          role: values.role || "viewer",
        });
        message.success("创建成功");
      }
      setModalVisible(false);
      fetchUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  const columns = [
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
      render: (username: string) => (
        <Space>
          <Tag icon={<UserOutlined />} color="blue">{username}</Tag>
        </Space>
      ),
    },
    {
      title: "显示名称",
      dataIndex: "display_name",
      key: "display_name",
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (role: UserRole) => (
        <Tag color={roleColors[role]}>{role}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      render: (enabled: boolean) => (
        <Tag color={enabled ? "green" : "default"}>
          {enabled ? "正常" : "禁用"}
        </Tag>
      ),
    },
    {
      title: "最后登录",
      dataIndex: "last_login_at",
      key: "last_login_at",
      render: (time: number) => time ? new Date(time).toLocaleString() : "-",
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (time: number) => new Date(time).toLocaleString(),
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定删除此用户?"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 100 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Card
          title="用户管理"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建用户
            </Button>
          }
        >
          <Table
            dataSource={users}
            columns={columns}
            rowKey="id"
            pagination={false}
          />
        </Card>
      )}

      <Modal
        title={editingUser ? "编辑用户" : "新建用户"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editingUser && (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: "请输入用户名" }]}
              >
                <Input placeholder="用户名" />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: "请输入密码" }]}
              >
                <Input.Password placeholder="密码" />
              </Form.Item>
            </>
          )}

          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="显示名称" />
          </Form.Item>

          <Form.Item name="email" label="邮箱">
            <Input type="email" placeholder="邮箱地址" />
          </Form.Item>

          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select
              options={roles.map((r) => ({
                value: r,
                label: r,
              }))}
            />
          </Form.Item>

          {editingUser && (
            <Form.Item name="enabled" label="状态" valuePropName="checked">
              <Select
                options={[
                  { value: true, label: "启用" },
                  { value: false, label: "禁用" },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
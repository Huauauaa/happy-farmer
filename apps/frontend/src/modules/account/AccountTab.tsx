import { Button, Card, Col, Input, Row, Space, Tag, Typography } from 'antd';

type UserProfile = {
  id: string;
  username: string;
  nickname: string | null;
  phone: string | null;
  balance: number;
  isAdmin: boolean;
  createdAt: string;
};

type AccountTabProps = {
  authError: string | null;
  authMessage: string | null;
  token: string;
  profile: UserProfile | null;
  authLoading: boolean;
  loginUsername: string;
  loginPassword: string;
  registerUsername: string;
  registerPassword: string;
  registerNickname: string;
  registerPhone: string;
  editNickname: string;
  editPhone: string;
  currentPassword: string;
  newPassword: string;
  formatDateTime: (value: string) => string;
  setLoginUsername: (value: string) => void;
  setLoginPassword: (value: string) => void;
  setRegisterUsername: (value: string) => void;
  setRegisterPassword: (value: string) => void;
  setRegisterNickname: (value: string) => void;
  setRegisterPhone: (value: string) => void;
  setEditNickname: (value: string) => void;
  setEditPhone: (value: string) => void;
  setCurrentPassword: (value: string) => void;
  setNewPassword: (value: string) => void;
  handleLogin: () => Promise<void>;
  handleRegister: () => Promise<void>;
  handleUpdateProfile: () => Promise<void>;
  handleChangePassword: () => Promise<void>;
  handleLogout: () => Promise<void>;
};

function AccountTab({
  authError,
  authMessage,
  token,
  profile,
  authLoading,
  loginUsername,
  loginPassword,
  registerUsername,
  registerPassword,
  registerNickname,
  registerPhone,
  editNickname,
  editPhone,
  currentPassword,
  newPassword,
  formatDateTime,
  setLoginUsername,
  setLoginPassword,
  setRegisterUsername,
  setRegisterPassword,
  setRegisterNickname,
  setRegisterPhone,
  setEditNickname,
  setEditPhone,
  setCurrentPassword,
  setNewPassword,
  handleLogin,
  handleRegister,
  handleUpdateProfile,
  handleChangePassword,
  handleLogout,
}: AccountTabProps) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {authError ? <Tag color="error">操作失败：{authError}</Tag> : null}
      {authMessage ? <Tag color="success">{authMessage}</Tag> : null}

      {token === '' ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="用户登录">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Input placeholder="账号" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} />
                <Input.Password
                  placeholder="密码"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  onPressEnter={() => {
                    void handleLogin();
                  }}
                />
                <Button type="primary" loading={authLoading} onClick={() => void handleLogin()}>
                  登录
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="用户注册">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Input
                  placeholder="账号（3-32位字母/数字/下划线）"
                  value={registerUsername}
                  onChange={(event) => setRegisterUsername(event.target.value)}
                />
                <Input.Password
                  placeholder="密码（6-64位）"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                />
                <Input
                  placeholder="昵称（可选）"
                  value={registerNickname}
                  onChange={(event) => setRegisterNickname(event.target.value)}
                />
                <Input
                  placeholder="手机号（可选）"
                  value={registerPhone}
                  onChange={(event) => setRegisterPhone(event.target.value)}
                />
                <Button loading={authLoading} onClick={() => void handleRegister()}>
                  注册
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      ) : (
        <>
          <Card title="账号信息">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Text>账号：{profile?.username ?? '-'}</Typography.Text>
              <Typography.Text>昵称：{profile?.nickname ?? '未设置'}</Typography.Text>
              <Typography.Text>手机号：{profile?.phone ?? '未设置'}</Typography.Text>
              <Typography.Text>余额：¥{(profile?.balance ?? 0).toFixed(2)}</Typography.Text>
              <Typography.Text>注册时间：{profile ? formatDateTime(profile.createdAt) : '-'}</Typography.Text>
              <Button danger onClick={() => void handleLogout()}>
                退出登录
              </Button>
            </Space>
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="更新个人信息">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Input placeholder="昵称" value={editNickname} onChange={(event) => setEditNickname(event.target.value)} />
                  <Input placeholder="手机号" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} />
                  <Button type="primary" loading={authLoading} onClick={() => void handleUpdateProfile()}>
                    保存资料
                  </Button>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="修改密码">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Input.Password
                    placeholder="当前密码"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                  <Input.Password placeholder="新密码" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  <Button type="primary" loading={authLoading} onClick={() => void handleChangePassword()}>
                    修改密码
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Space>
  );
}

export default AccountTab;

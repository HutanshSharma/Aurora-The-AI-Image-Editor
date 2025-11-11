import { useState } from 'react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import ForgotPassword from './ForgotPassword';
import Panel from './Panel';
import Beams from './Beams';

export default function AuthPage({addToast}) {
  const [isLogin, setIsLogin] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowComfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  const [forgotpasswordData, setForgotPasswordData] = useState({
    email: ''
  })
  const [isPasswordChange, setisPasswordChange] = useState(false)

  const checkPasswordRequirements = (password) => ({
    length: password.length >= 8,
    numberOrSymbol: /[0-9!@#$%^&*]/.test(password),
    caseRequirement: /[a-z]/.test(password) && /[A-Z]/.test(password)
  });

  const requirements = checkPasswordRequirements(signupData.password);  

  return (
    <div className='relative sm:min-h-screen sm:flex sm:items-center sm:justify-center bg-gradient-to-br from-gray-950 via-red-950 to-gray-950'>
      <div className="absolute inset-0 overflow-hidden">
        <Beams
          beamWidth={2}
          beamHeight={15}
          beamNumber={50}
          lightColor="rgb(239,68,68)"
          speed={3}
          noiseIntensity={2}
          scale={0.2}
          rotation={20}
        />
      </div>
        <Panel />
      <div className="w-full sm:max-w-sm flex items-center justify-center backdrop-blur-xs text-white">
        <div className="w-full bg-[rgba(0,0,0,0.7)] rounded-t-4xl sm:rounded-4xl p-6 shadow-xl">
            <div className="flex bg-[#1b1b1b] rounded-full p-1 mb-6">
              <button
                className={`flex-1 py-2 text-sm rounded-full transition ${
                  isLogin ? "bg-white text-black" : "text-gray-400"
                }`}
                onClick={() =>{
                  setisPasswordChange(false)
                  setIsLogin(true)
                }
                }
              >
                Login
              </button>
              <button
                className={`flex-1 py-2 text-sm rounded-full transition ${
                  !isLogin ? "bg-white text-black" : "text-gray-400"
                }`}
                onClick={() =>{
                  setisPasswordChange(false)
                  setIsLogin(false)
                }}
              >
                Register
              </button>
            </div>

            <div className="form-wrapper">
              <div className={`form login-form ${isLogin && !isPasswordChange ? 'active' : ''}`}>
                <LoginForm
                  setLoginData={setLoginData}
                  showLoginPassword={showLoginPassword}
                  loginData={loginData}
                  setShowLoginPassword={setShowLoginPassword}
                  addToast = {addToast}
                  setisPasswordChange = {setisPasswordChange}
                  setIsLogin = {setIsLogin}
                />
              </div>

              <div className={`form signup-form ${!isLogin && !isPasswordChange ? 'active' : ''}`}>
                <SignUpForm
                  setShowSignupPassword={setShowSignupPassword}
                  setSignupData={setSignupData}
                  signupData={signupData}
                  showSignupPassword={showSignupPassword}
                  requirements={requirements}
                  setShowComfirmPassword={setShowComfirmPassword}
                  showConfirmPassword={showConfirmPassword}
                  addToast={addToast}
                  setIsLogin={setIsLogin}
                />
              </div>

              <div className={`form signup-form ${isLogin && isPasswordChange ? 'active' : ''}`}>
                <ForgotPassword 
                  setForgotPasswordData = {setForgotPasswordData}
                  forgotpasswordData = {forgotpasswordData}
                  setIsLogin = {setIsLogin}
                  setisPasswordChange = {setisPasswordChange}
                  addToast = {addToast}
                />
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}

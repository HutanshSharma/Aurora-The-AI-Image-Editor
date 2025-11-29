export default function handleSignUp(signupData, requirements, addToast, setIsLogin, setIsLoading){
  if(signupData.name === '' || signupData.email === '' || signupData.password === ''){
    addToast('Required Fields are empty','error')
    return 
  }
  if(!isValidEmail(signupData.email)){
    addToast("Email I'd is not valid", 'error')
    return 
  }
  if(!requirements.length || !requirements.numberOrSymbol || !requirements.caseRequirement){
    addToast('Password requirements not met.','error')
    return 
  }
  if(signupData.password != signupData.confirmPassword){
    addToast('Password and confirm password do not match','error')
    return 
  }

  setIsLoading(true);

  (async function(){
    try{
      const response = await fetch("http://localhost:8000/auth/",{
      method:"POST",
      body:JSON.stringify({
        username : signupData.name,
        email : signupData.email,
        password : signupData.password
      }),
      headers:{
        "Content-Type":"application/json"
      }
      })
      const resData = await response.json()
      if(!response.ok){
        addToast(resData.detail, 'error')
        setIsLoading(false);
        return
      }
    }
    catch(error){
      addToast('Something went wrong. Please try again later.','invalid')
      setIsLoading(false);
      return
    }

    try{
      const token = await fetch("http://localhost:8000/auth/token",{
        method:"POST",
        body:JSON.stringify({"email":signupData.email,
                            "password" : signupData.password
        }),
        headers:{
          "Content-Type":'application/JSON'
        }
      })

      const tokenData = await token.json()
      if(!token.ok){
        addToast('Something went wrong. Please try logging in.','invalid')
        setIsLogin(true)
        setIsLoading(false);
        return
      }
      sessionStorage.setItem('access_token',tokenData['access_token'])
    }
    catch(error){
      console.log(error)
      addToast('Something went wrong. Please try logging in.','invalid')
      setIsLogin(true)
      setIsLoading(false);
      return
    }

    try{
        const refresh_token = await fetch("http://localhost:8000/auth/refresh_token",{
          method:"POST",
          body:JSON.stringify({"email":signupData.email,
                              "password" :signupData.password
          }),
          headers:{
            "Content-Type":'application/JSON'
          }
        })

        const refreshData = await refresh_token.json()
        if(!refresh_token.ok){
          addToast(refreshData.detail,'error')
          setIsLoading(false);
          return
        }
        addToast('Account created and logged in successfully.','success')
        localStorage.setItem('refresh_token',refreshData['refresh_token'])
        setIsLoading(false);
        window.location.href = '/'
      }
      catch(error){
        addToast('Something went wrong. Please try again later.','invalid')
        setIsLoading(false);
        return
      }
  })()
}

function isValidEmail(email) {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}
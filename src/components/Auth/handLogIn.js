export default function handleLogIn(loginData,addToast){
    if(loginData.name === '' || loginData.password === ''){
      addToast('Required Fields are empty','error')
      return 
    }
    if(!isValidEmail(loginData.email)){
      addToast("Email I'd is not valid", 'error')
      return 
    }

    (async function(){
      try{
        const token = await fetch("http://localhost:8000/auth/token",{
          method:"POST",
          body:JSON.stringify({"email":loginData.email,
                              "password" :loginData.password
          }),
          headers:{
            "Content-Type":'application/JSON'
          }
        })

        const tokenData = await token.json()
        if(!token.ok){
          addToast(tokenData.detail,'error')
          return
        }
        sessionStorage.setItem('access_token',tokenData['access_token'])
      }
      catch(error){
        addToast('Something went wrong. Please try again later.','invalid')
        return
      }

      try{
        const refresh_token = await fetch("http://localhost:8000/auth/refresh_token",{
          method:"POST",
          body:JSON.stringify({"email":loginData.email,
                              "password" :loginData.password
          }),
          headers:{
            "Content-Type":'application/JSON'
          }
        })

        const refreshData = await refresh_token.json()
        if(!refresh_token.ok){
          addToast(refreshData.detail,'error')
          return
        }
        addToast("Logged in successfully","success")
        localStorage.setItem('refresh_token',refreshData['refresh_token'])
      }
      catch(error){
        addToast('Something went wrong. Please try again later.','invalid')
        return
      }
    })()
}

function isValidEmail(email) {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}
import { API_BASE } from '../../../utils/config';

export default function handleLogIn(loginData, addToast, setIsLoading, navigate){
    if(loginData.email === '' || loginData.password === ''){
      addToast('Required Fields are empty','error')
      return 
    }
    if(!isValidEmail(loginData.email)){
      addToast("Email ID is not valid", 'error')
      return 
    }

    setIsLoading(true);

    (async function(){
      try{
        const token = await fetch(`${API_BASE}/auth/token`,{
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
          setIsLoading(false);
          return
        }
        sessionStorage.setItem('access_token',tokenData['access_token'])
      }
      catch(error){
        addToast('Something went wrong. Please try again later.','invalid')
        setIsLoading(false);
        return
      }

      try{
        const refresh_token = await fetch(`${API_BASE}/auth/refresh_token`,{
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
          setIsLoading(false);
          return
        }
        localStorage.setItem('refresh_token',refreshData['refresh_token'])
        addToast("Logged in successfully","success")
        setIsLoading(false);
        if (navigate) navigate('/', { replace: true })
        else window.location.href = '/'
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
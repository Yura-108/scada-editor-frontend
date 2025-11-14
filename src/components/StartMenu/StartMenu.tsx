import './StartMenu.scss'
import axios from "axios";
import type {FormEvent} from "react";

interface FormData {
  site: string;
  project: string;
}

const StartMenu = ({setTreeData, setInitialDeviceParams, setVisibleTree}) => {
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const formData: FormData = {
      site: form.site.value,
      project: form.projectInput.value
    };
    try {
      const response = await axios.get('http://localhost:8080/api/node/all', {
        params: {
          site: formData.site,
          project: formData.project
        }
      });
      setTreeData(response.data.nodes);
      setInitialDeviceParams(response.data.params);
      setVisibleTree(true);
    } catch (error) {
      console.error('Ошибка при отправке запроса:', error);
    }
  }

  return (
    <div className="form-start">
      <form className="form-start__form" onSubmit={handleSubmit}>
        <label className="form-start__label" htmlFor="site">Площадка</label>
        <input className="form-start__input" name="site" id="site" type="text"/>

        <label className="form-start__label" htmlFor="projectInput">Проект</label>
        <input className="form-start__input" name="projectInput" id="projectInput" type="text"/>

        <button className="form-start__submit" type="submit">Найти</button>
      </form>
    </div>
  )
}

export default StartMenu;
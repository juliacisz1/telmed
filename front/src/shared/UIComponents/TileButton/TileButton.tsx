import {useNavigate} from "react-router-dom";
import type {ReactNode} from "react";
import '../../Styles/PageStyle.css'

type ButtonProps = {
    icon?: ReactNode;
    title?: string;
    description?: string;
    to: string;
};

export function TileButton({icon, title, description, to}: ButtonProps) {
    const navigate = useNavigate();
    return (
        <button type="button" className="tileButton" onClick={() => navigate(to)}>
            {icon && icon}
            {title && <div className="title">{title}</div>}
            {description && <div>{description}</div>}
        </button>
    )
}